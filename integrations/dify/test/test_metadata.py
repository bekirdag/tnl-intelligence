from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

import yaml

INTEGRATION_ROOT = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = INTEGRATION_ROOT / "tnl_intelligence"


class MetadataTest(unittest.TestCase):
    def test_provider_and_tool_inventory(self) -> None:
        provider = yaml.safe_load(
            (PLUGIN_ROOT / "provider/tnl_intelligence.yaml").read_text()
        )
        expected = [
            "tools/search_intelligence.yaml",
            "tools/get_intelligence.yaml",
            "tools/list_recent_changes.yaml",
            "tools/get_exposure.yaml",
            "tools/run_research.yaml",
            "tools/get_weekly_edition.yaml",
        ]
        self.assertEqual(provider["tools"], expected)
        for relative in expected:
            definition = yaml.safe_load((PLUGIN_ROOT / relative).read_text())
            self.assertEqual(
                definition["identity"]["name"], Path(relative).stem
            )
            self.assertIn("result", definition["output_schema"]["properties"])

    def test_repository_validator(self) -> None:
        completed = subprocess.run(
            [sys.executable, str(INTEGRATION_ROOT / "scripts/validate.py")],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        self.assertIn("validation passed", completed.stdout)


if __name__ == "__main__":
    unittest.main()

