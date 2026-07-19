from __future__ import annotations

import argparse
import sys
from collections.abc import Mapping
from pathlib import Path

from .models import canonical_json
from .sample import (
    SAMPLE_VERSION,
    sample_mappings,
    sample_observations,
    sample_outcomes,
    sample_sessions,
)


def build_assets() -> dict[str, bytes]:
    data_prefix = "data/"
    assets: dict[str, bytes] = {
        f"{data_prefix}observations.jsonl": "".join(
            f"{canonical_json(item.to_dict())}\n" for item in sample_observations()
        ).encode(),
        f"{data_prefix}mappings.json": _json([item.to_dict() for item in sample_mappings()]),
        f"{data_prefix}sessions.json": _json(list(sample_sessions())),
        f"{data_prefix}outcomes.json": _json(list(sample_outcomes())),
        f"{data_prefix}provenance.json": _json(
            {
                "dataset": "tnl-quant-synthetic",
                "version": SAMPLE_VERSION,
                "generatedAt": "2026-07-18T00:00:00Z",
                "generator": "tnl_intelligence.quant.asset_builder",
                "license": "CC0-1.0",
                "containsProductionData": False,
                "containsThirdPartyArticleText": False,
                "scenarios": [
                    "revision",
                    "retraction",
                    "late arrival",
                    "ambiguous mapping",
                    "timezone offset",
                ],
            }
        ),
        f"{data_prefix}LICENSE.md": (
            b"# Synthetic Fixture License\n\n"
            b"The files in this directory are synthetic and dedicated to the public domain "
            b"under CC0 1.0. They contain no live TNL data, credentials, market data, or "
            b"third-party article text.\n"
        ),
    }
    notebooks = {
        "01-point-in-time.ipynb": (
            "Point-in-Time Dataset Quick Start",
            "from tnl_intelligence.quant.examples import point_in_time_example\n"
            "result = point_in_time_example()\n"
            "assert result['valid'] and not result['hindsight']\n"
            "result",
        ),
        "02-event-study.ipynb": (
            "Event Study With User-Supplied Synthetic Outcomes",
            "from tnl_intelligence.quant.examples import event_study_example\n"
            "result = event_study_example()\n"
            "assert result['rowCount'] > 0\n"
            "result",
        ),
        "03-entity-exposure.ipynb": (
            "Time-Aware Entity and Asset Exposure",
            "from tnl_intelligence.quant.examples import exposure_example\n"
            "result = exposure_example()\n"
            "assert result['exposureRows'] > 0\n"
            "result",
        ),
        "04-weekly-consequence.ipynb": (
            "Weekly Consequential Developments Dataset",
            "from tnl_intelligence.quant.examples import weekly_consequence_example\n"
            "result = weekly_consequence_example()\n"
            "assert result['attribution'] == 'TNL Bot'\n"
            "result",
        ),
    }
    for name, (title, code) in notebooks.items():
        assets[f"notebooks/{name}"] = _json(_notebook(title, code))
    return dict(sorted(assets.items()))


def write_assets(output: str | Path, *, check: bool = False) -> tuple[str, ...]:
    root = Path(output).expanduser().resolve()
    changed: list[str] = []
    for relative, content in build_assets().items():
        target = root / relative
        if not target.exists() or target.read_bytes() != content:
            changed.append(relative)
            if not check:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(content)
    if check:
        expected = set(build_assets())
        existing = (
            {
                str(path.relative_to(root))
                for path in root.rglob("*")
                if path.is_file() and path.name != "__init__.py"
            }
            if root.exists()
            else set()
        )
        changed.extend(sorted(existing - expected))
    return tuple(sorted(set(changed)))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    changed = write_assets(args.output, check=args.check)
    if args.check and changed:
        sys.stderr.write(f"quant assets are stale: {', '.join(changed)}\n")
        return 1
    sys.stdout.write(
        f"quant assets {'verified' if args.check else 'generated'}: {len(build_assets())}\n"
    )
    return 0


def _json(value: object) -> bytes:
    return f"{canonical_json(value)}\n".encode()


def _notebook(title: str, code: str) -> Mapping[str, object]:
    return {
        "cells": [
            {
                "cell_type": "markdown",
                "id": "introduction",
                "metadata": {},
                "source": [
                    f"# {title}\n",
                    "\n",
                    "Synthetic, point-in-time research example. Not financial advice.\n",
                ],
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "id": "run-example",
                "metadata": {},
                "outputs": [],
                "source": [f"{line}\n" for line in code.splitlines()],
            },
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "version": "3.10"},
            "tnl": {"fixture": "synthetic", "version": SAMPLE_VERSION},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }


if __name__ == "__main__":
    raise SystemExit(main())
