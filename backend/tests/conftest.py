"""
Pytest configuration file for test path setup.

This file is automatically loaded by pytest and sets up the Python path
for all tests in this directory, eliminating the need for manual path
setup in individual test files.
"""

import os
import sys

# Get the tests directory
TESTS_DIR = os.path.dirname(__file__)

# Get the backend root (one level up from tests)
BACKEND_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))

# Get the project root (two levels up from tests)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, "..", ".."))

# Add both to sys.path
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)
