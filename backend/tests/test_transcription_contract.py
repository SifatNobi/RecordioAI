"""Regression checks for the mobile transcription authentication contract."""

import ast
from pathlib import Path


SERVER_PATH = Path(__file__).parents[1] / "server.py"


def _transcribe_function() -> ast.AsyncFunctionDef:
    tree = ast.parse(SERVER_PATH.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "transcribe":
            return node
    raise AssertionError("transcribe route was not found")


def test_transcription_route_does_not_require_user_session():
    route = _transcribe_function()
    route_text = ast.unparse(route)
    assert "Depends(get_current_user)" not in route_text


def test_transcription_route_still_requires_multipart_file():
    route = _transcribe_function()
    parameter_names = {arg.arg for arg in route.args.args}
    assert "file" in parameter_names
    assert "UploadFile" in ast.unparse(route)
