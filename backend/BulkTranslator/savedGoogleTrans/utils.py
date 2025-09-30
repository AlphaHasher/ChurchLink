# -*- coding: utf-8 -*-
"""
Utility functions for Google Translate API
"""

def rshift(val: int, n: int) -> int:
    """
    Simulate JavaScript's right shift operation.
    
    In JavaScript, the >>> operator performs an unsigned right shift.
    Python doesn't have this operator, so we simulate it.
    """
    return (val % 0x100000000) >> n 