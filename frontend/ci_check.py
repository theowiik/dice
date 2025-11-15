import subprocess
from typing import Callable
import os
import re

# VVV CUSTOM CHECKS VVV

# ^^^ CUSTOM CHECKS ^^^


checks: list[tuple[str, str | Callable[[], bool]]] = [
    ("Biome check", "pnpm run check"),
    ("Build", "pnpm run build"),
]

def _run_cmd(cmd: str) -> bool:
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=False, text=True)
        return result.returncode == 0
    except subprocess.CalledProcessError:
        return False


def _print_results(results: list[tuple[str, str | Callable, bool]]) -> None:
    check_width = max(len(check) for check, _, _ in results) if results else 10
    print("\nResults:")
    
    for check, cmd, result in results:
        status = "✅" if result else "❌"
        cmd_str = cmd if isinstance(cmd, str) else cmd.__name__
        print(f"{status} {check:<{check_width}} | {cmd_str}")
    print()


def check() -> bool:
    results: list[tuple[str, str | Callable, bool]] = []

    for check, cmd in checks:
        if isinstance(cmd, str):
            results.append((check, cmd, _run_cmd(cmd)))
        else:
            results.append((check, cmd, cmd()))

    _print_results(results)

    return all(result for _, _, result in results)


if __name__ == "__main__":
    exit(0 if check() else 1)
