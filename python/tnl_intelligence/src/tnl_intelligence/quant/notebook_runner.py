from __future__ import annotations

import importlib
import tempfile
from pathlib import Path

from .errors import MissingOptionalDependency


def execute_notebooks(path: str | Path) -> tuple[str, ...]:
    try:
        nbformat = importlib.import_module("nbformat")
        nbclient = importlib.import_module("nbclient")
    except ImportError as error:
        raise MissingOptionalDependency("nbclient and nbformat", "notebooks") from error
    root = Path(path).expanduser().resolve()
    executed: list[str] = []
    for notebook_path in sorted(root.glob("*.ipynb")):
        notebook = nbformat.read(notebook_path, as_version=4)
        with tempfile.TemporaryDirectory(prefix="tnl-notebook-") as work_dir:
            client = nbclient.NotebookClient(
                notebook,
                timeout=120,
                kernel_name="python3",
                resources={"metadata": {"path": work_dir}},
            )
            client.execute()
        executed.append(notebook_path.name)
    return tuple(executed)


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()
    executed = execute_notebooks(args.path)
    print(f"executed {len(executed)} notebooks: {', '.join(executed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
