import time
import json
import lesson03
import tracemalloc
from pathlib import Path
from datetime import datetime
from itertools import islice, batched, groupby, chain, pairwise, tee
from collections import defaultdict
from typing import Iterator
from contextlib import contextmanager

def take(it, n):
    return islice(it, n)

def drop(it, n):
    return islice(it, n, None)

def chunked(it, size):
    for batch in batched(it, size):
        yield list(batch)

def manual_batched(iterator, size):
    it = iter(iterator)
    batch = islice(it, size)
    while batch:
        yield tuple(batch)
        batch = islice(it, size)

def insert(record):
    time.sleep(0.0005)

def insert_many(records):
    time.sleep(0.0005 + 0.00001 * len(records))

def insert_one_by_one(records):
    for record in records:
        insert(record)

def insert_in_batches(records, batch_size):
    for batch in chunked(records, batch_size):
        insert_many(batch)

def read_jsonl(path):
    with open(path, 'r') as f:
        for line in f:
            if line.strip():
                try:
                    yield json.loads(line)
                except Exception:
                    
                    continue

def read_patitioned(directory, pattern = "*.jsonl") -> Iterator[dict]:

    paths = (p for p in Path(directory).glob(pattern))
    for f in paths:
        print(f"opening {f}")
        yield from read_jsonl(f)

def track_variations(records, N):

    for r1, r2 in pairwise(records):
        minutes = (r2["timestamp"] - r1["timestamp"]).total_seconds() / 60
        yield (r2["value"] - r1["value"], minutes > N)
    
def route_single_loop(records, valid_sink, rejected_sink):
    """Route each item to one of two sinks in a single pass."""
    for record, error in records:
        if error is not None:
            rejected_sink(error)
        else:
            valid_sink(record)

def route_with_tee(records, valid_sink, rejected_sink):
    """Duplicate the stream and filter each branch separately."""
    branch_a, branch_b = tee(records, 2)

    valid = (record for record, error in branch_a if error is None)
    rejected = (error for record, error in branch_b if error is not None)

    for record in valid:
        valid_sink(record)
    for error in rejected:      
        rejected_sink(error)

@contextmanager
def measure_peak(label: str):
    tracemalloc.start()
    try:
        yield
    finally:
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        print(f"{label}: peak {peak / 1024 ** 2:.1f} MB")

def make_records(n: int):
    """Yield n (record, error) pairs, ~10% of which are errors."""
    for i in range(n):
        if i % 10 == 0:
            yield (None, f"error on line {i}")
        else:
            yield ({"id": i, "value": i * 2}, None)

class CountingSink:
    """A sink that only counts, so it doesn't affect the measurement."""
    def __init__(self):
        self.count = 0
    def __call__(self, item):
        self.count += 1

def main():

    #Ex. 4.1: Using itertools, the code is shorter and more readable
    assert list(chunked([1,2,3,4,5], 2)) == [[1,2], [3,4], [5]]
    assert list(take([10, 11, 12], 2)) == [10,11]
    assert list(drop([1, 2, 3, 4], 2)) == [3,4]

    #Ex. 4.4
    data = [("a",1), ("b",2), ("a",3)]

    result = {k: list(g) for k, g in groupby(data, key=lambda x: x[0])}
    print (result) #problem: second instance of 'a' overrided the previous group

    #4.4 b) Ordering before
    ordered_data = sorted(data, key=lambda x: x[0])
    result = {k: list(g) for k, g in groupby(ordered_data, key=lambda x: x[0])}
    print (result) #Now correctly groups every instance of "a"

    #4.4 c) defaultdict
    dd = defaultdict(list)
    for k, v in data:
        dd[k].append((k, v))
    print(dict(dd))  # groups preserved without sorting

    # - Sorting + groupby: uses more memory because sorted() builds a full
    #   copy of the data (O(n) extra). It's better when you need groups in
    #   key order or when you prefer streaming groups from an iterable.
    # - defaultdict approach: uses less transient memory (no full copy),
    #   but still stores grouped data in the dict; it's better when original
    #   order should be preserved and when you want to accumulate groups
    #   without re-sorting.

    #Ex. 4.5
    # Test read_patitioned function
    BASE_DIR = Path(__file__).parent          
    TEST_PATH = BASE_DIR / "data" 
    for records_iterator in read_patitioned(TEST_PATH):
        for record in records_iterator:
            print(record)
            break  # Just test first record
        break  # Just test first file

    #Ex. 4.6
    sample_data = [
        {"timestamp": "2024-01-01T08:00:00", "value": 42.5},
        {"timestamp": "2024-01-01T09:00:00", "value": 38.2},
        {"timestamp": "2024-01-01T10:00:00", "value": 45.1},
        {"timestamp": "2024-01-01T12:00:00", "value": 41.8},
        {"timestamp": "2024-01-01T12:30:00", "value": 50.3},
        {"timestamp": "2024-01-01T16:00:00", "value": 39.7},
    ]

    # Test track_variations: parse timestamps and run with N=60 minutes
    parsed = [
        {"timestamp": datetime.fromisoformat(d["timestamp"]), "value": d["value"]}
        for d in sample_data
    ]
    variations = list(track_variations(parsed, 60))
    print("variations:", variations)
    

    #Ex. 4.3: insert() one by one vs insert_many() in batches
    records = list(range(10_000))

    start = time.perf_counter()
    insert_one_by_one(records)
    one_by_one_time = time.perf_counter() - start
    print(f"insert() x10000 (one by one):        {one_by_one_time:.4f}s")

    start = time.perf_counter()
    insert_many(records)
    single_batch_time = time.perf_counter() - start
    print(f"insert_many() x1 (single batch 10000): {single_batch_time:.4f}s")

    
    print()
    for batch_size in (10, 100, 1000, 10_000):
        start = time.perf_counter()
        insert_in_batches(records, batch_size)
        elapsed = time.perf_counter() - start
        num_calls = len(records) // batch_size
        print(f"batch_size={batch_size:>6}: {elapsed:.4f}s ({num_calls} calls to insert_many)")

    # Measured results for 10000 records 
    #   one by one:      11.68s   (10000 insert() calls)
    #   batch=10:        1.21s   (1000 insert_many calls)
    #   batch=100:       0.22s   (100 insert_many calls)
    #   batch=1000:      0.12s   (10 insert_many calls)
    #   batch=10000:     0.10s   (1 insert_many call)
    #
    # insert_many has a fixed cost per call (0.0005s) and a variable cost per
    # record (0.00001s, ~0.1s total, independent of how the 10000 records
    # are split). Batching only saves the fixed part, so the gain per avoided
    # call is always the same, but the number of calls avoided drops quickly:
    # 10->100 removes 900 calls (large saving), 100->1000 removes only 90,
    # and 1000->10000 removes only 9 (saving ~0.02s, almost nothing).
    # The curve is practically flat from batch=1000 on: the variable cost
    # (~0.1s) already dominates total time and no larger batch reduces it in
    # a noticeable way, so batch=1000 is the practical point of diminishing
    # returns (larger batches do not bring gains that justify the bigger
    # batch, e.g., memory use, per-batch latency, etc.).


    # Ex. 4.7

    N = 200_000

    with measure_peak("single loop"):
        valid, rejected = CountingSink(), CountingSink()
        route_single_loop(make_records(N), valid, rejected)
        print(f"  valid={valid.count} rejected={rejected.count}")

    with measure_peak("tee"):
        valid, rejected = CountingSink(), CountingSink()
        route_with_tee(make_records(N), valid, rejected)
        print(f"  valid={valid.count} rejected={rejected.count}")

    #peak was 0.0MB on single loop, 56.1MB on tee.
    #tee solution does not seem appropriate in this case.


if __name__ == "__main__":
    main()
