#!/usr/bin/env python3
from __future__ import annotations

import ast
import hashlib
import re
import sys
from pathlib import Path

import yaml

INTEGRATION_ROOT = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = INTEGRATION_ROOT / "tnl_intelligence"
EXPECTED_TOOLS = (
    "search_intelligence",
    "get_intelligence",
    "list_recent_changes",
    "get_exposure",
    "run_research",
    "get_weekly_edition",
)
EXPECTED_LOGO_SHA256 = "b5cf9e6384f624c3faad29491d19985f12dac02f67029186867c102c9f603c50"
PROHIBITED_PARTS = {
    ".DS_Store",
    ".env",
    ".git",
    ".idea",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
}


def fail(message: str) -> None:
    raise SystemExit(f"Dify validation failed: {message}")


def load_yaml(path: Path) -> dict:
    value = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        fail(f"{path.relative_to(INTEGRATION_ROOT)} must contain a YAML object")
    return value


def require_file(relative: str) -> Path:
    path = PLUGIN_ROOT / relative
    if not path.is_file():
        fail(f"missing {relative}")
    return path


def validate_manifest() -> None:
    manifest = load_yaml(require_file("manifest.yaml"))
    expected = {
        "version": "0.1.0",
        "type": "plugin",
        "author": "bekirdag",
        "name": "tnl_intelligence",
        "privacy": "PRIVACY.md",
    }
    for key, value in expected.items():
        if manifest.get(key) != value:
            fail(f"manifest {key} must be {value!r}")
    if manifest.get("meta", {}).get("runner") != {
        "language": "python",
        "version": "3.12",
        "entrypoint": "main",
    }:
        fail("manifest runner must use Python 3.12 and main")
    if manifest.get("plugins", {}).get("tools") != [
        "provider/tnl_intelligence.yaml"
    ]:
        fail("manifest must reference the TNL provider")
    for key in ("icon", "icon_dark"):
        require_file(f"_assets/{manifest.get(key, '')}")


def validate_provider_and_tools() -> None:
    provider = load_yaml(require_file("provider/tnl_intelligence.yaml"))
    credential = provider.get("credentials_for_provider", {}).get("tnl_api_key", {})
    if credential.get("type") != "secret-input" or credential.get("required") is not True:
        fail("tnl_api_key must be a required secret-input")
    expected_paths = [f"tools/{name}.yaml" for name in EXPECTED_TOOLS]
    if provider.get("tools") != expected_paths:
        fail("provider tool order or inventory is incorrect")
    if provider.get("extra", {}).get("python", {}).get("source") != (
        "provider/tnl_intelligence.py"
    ):
        fail("provider Python source is incorrect")

    for name in EXPECTED_TOOLS:
        definition = load_yaml(require_file(f"tools/{name}.yaml"))
        if definition.get("identity", {}).get("name") != name:
            fail(f"{name} identity is incorrect")
        if definition.get("identity", {}).get("author") != "bekirdag":
            fail(f"{name} author is incorrect")
        if "result" not in definition.get("output_schema", {}).get("properties", {}):
            fail(f"{name} must expose a structured result")
        source = definition.get("extra", {}).get("python", {}).get("source")
        if source != f"tools/{name}.py":
            fail(f"{name} Python source is incorrect")
        source_path = require_file(source)
        ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))


def validate_metadata_and_dependencies() -> None:
    readme = require_file("README.md").read_text(encoding="utf-8")
    privacy = require_file("PRIVACY.md").read_text(encoding="utf-8")
    if re.search(r"[\u3400-\u9fff]", readme):
        fail("README.md must keep primary user-facing content in English")
    for marker in (
        "https://github.com/bekirdag/tnl-intelligence",
        "https://theneuralledger.com/privacy",
        "tnladmin@theneuralledger.com",
    ):
        if marker not in readme + privacy:
            fail(f"documentation is missing {marker}")
    requirements = {
        line.strip()
        for line in require_file("requirements.txt").read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    if requirements != {
        "dify_plugin>=0.9.1,<0.10.0",
        "requests>=2.32.0,<3.0.0",
    }:
        fail("requirements.txt is not pinned to the reviewed dependency range")
    pyproject = require_file("pyproject.toml").read_text(encoding="utf-8")
    for requirement in requirements:
        pyproject_requirement = requirement.replace("dify_plugin", "dify-plugin")
        if f'"{pyproject_requirement}"' not in pyproject:
            fail(f"pyproject.toml is missing {requirement}")


def validate_security_and_package_surface() -> None:
    allowed_urls = {
        "https://theneuralledger.com",
        "https://mcp.theneuralledger.com",
        "https://mcp.theneuralledger.com/mcp",
        "https://theneuralledger.com/member",
        "https://theneuralledger.com/privacy",
        "https://theneuralledger.com/terms",
        "https://theneuralledger.com/developers",
        "https://github.com/bekirdag/tnl-intelligence",
    }
    url_pattern = re.compile(r"https://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+")
    for path in PLUGIN_ROOT.rglob("*"):
        if any(part in PROHIBITED_PARTS for part in path.parts):
            continue
        if not path.is_file():
            continue
        if path.suffix in {".pyc", ".difypkg"}:
            fail(f"prohibited package file: {path.relative_to(PLUGIN_ROOT)}")
        if path.suffix in {".py", ".yaml", ".md", ".toml", ".txt"}:
            text = path.read_text(encoding="utf-8")
            for url in url_pattern.findall(text):
                normalized = url.rstrip(").,")
                if normalized not in allowed_urls:
                    fail(
                        f"unreviewed external URL in {path.relative_to(PLUGIN_ROOT)}: "
                        f"{normalized}"
                    )
            if re.search(r"tnl_live_key_[A-Za-z0-9_-]+", text):
                fail(f"credential-like value in {path.relative_to(PLUGIN_ROOT)}")
            ast.parse(text, filename=str(path)) if path.suffix == ".py" else None

    logo = require_file("_assets/icon.png")
    digest = hashlib.sha256(logo.read_bytes()).hexdigest()
    if digest != EXPECTED_LOGO_SHA256:
        fail("plugin icon is not the designated TNL logo")


def main() -> None:
    validate_manifest()
    validate_provider_and_tools()
    validate_metadata_and_dependencies()
    validate_security_and_package_surface()
    print("Dify plugin validation passed")


if __name__ == "__main__":
    try:
        main()
    except (SyntaxError, yaml.YAMLError) as error:
        fail(str(error))
