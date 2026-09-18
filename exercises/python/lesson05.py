

import tracemalloc
import time
from contextlib import contextmanager

@contextmanager
def measure_elapsed(label: str, trace_memory: bool):
    """measure and print elapsed time, and peak f memory if tracememory is true"""
    if trace_memory:
        tracemalloc.start()
    start_time = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start_time
        if trace_memory:
            _, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()
            print(f"{label}: elapsed { elapsed:.3f }s, peak {peak / 1024 ** 2:.1f} MB")
        else:
            print(f"{label}: elapsed { elapsed:.3f }s")
