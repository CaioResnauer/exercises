from __future__ import annotations

from collections.abc import Iterable, Iterator
from itertools import islice
from pathlib import Path
from typing import Optional, TypeVar

T = TypeVar("T")

saved: list[dict] = []
def save(record: dict) -> None:
    saved.append(record)

def read_csv_rows(path) -> Iterator[dict[str, str]]:
    """Iterable Csv Reader"""

    #This version of the implementation is much shorter, but can not be reused. if read_csv_rows("x.csv") is called 2 times, then each instance will be able to be used 1 time
    
    f = open(path, encoding='utf-8')
    columns = next(f).strip('\n').split(',')
    for line in f:
        yield dict(zip(columns, line.strip('\n').split(',')))

def test_generator() -> Iterator[int]:
    """A sample generator that yields three integers.

    Example:
        >>> list(test_generator())
        [1, 2, 3]
    """
    print("initiating")
    yield 1
    print("continuing")
    yield 2
    print("finalizing")
    yield 3

def naturals() -> Iterator[int]:
    """Generate an infinite sequence of natural numbers.

    Example:
        >>> list(take(naturals(), 3))
        [1, 2, 3]
    """
    count = 1
    while True:
        yield count
        count += 1

def take(iterable: Iterable[T], n: int) -> Iterator[T]:
    """Yield the first `n` values from an iterable.

    Example:
        >>> list(take([10, 11, 12], 2))
        [10, 11]
    """
    it = iter(iterable)
    for _ in range(n):
        yield next(it)

def drop(iterable: Iterable[T], n: int) -> Iterator[T]:
    """Skip the first `n` values and yield the rest.

    Example:
        >>> list(drop([1, 2, 3, 4], 2))
        [3, 4]
    """
    it = iter(iterable)
    for _ in range(n):
        next(it)
    yield from it

#Exercise 2.4 — Finding the bugs:

def run_pipeline(path: Path | str) -> None:
    """Read rows from a CSV file and save each record.

    Example:
        >>> run_pipeline('data/sales.csv')
    """
    records = read_csv_rows(path)
    if not any(records):
        raise ValueError("empty file")
    for record in records:
        save(record)

#Exercise 2.5

def flatten_deep(nested: object) -> Iterator[object]:
    """Flatten a nested iterable structure recursively.

    Example:
        >>> list(flatten_deep(['ab', ['cd']]))
        ['ab', 'cd']
    """
    if isinstance(nested, (str, bytes)):
        yield nested
        return
    try:
        for item in nested:  # type: ignore[arg-type]
            yield from flatten_deep(item)
    except TypeError:
        yield nested

#Exercise 2.6

def fake_api(page: int, page_size: int = 3, call_log: Optional[list[int]] = None) -> dict[str, list[int]]:
    """Simulate a paged API response.

    Example:
        >>> fake_api(1, page_size=2)
        {'results': [0, 1]}
    """
    if call_log is not None:
        call_log.append(page)
    all_records = list(range(10))
    start = (page - 1) * page_size
    results = all_records[start : start + page_size]
    return {"results": results}

def fetch_all(call_log: list[int]) -> Iterator[int]:
    """Fetch all records lazily from the fake API.

    Example:
        >>> calls: list[int] = []
        >>> list(islice(fetch_all(calls), 4))
        [0, 1, 2, 3]
    """
    page = 1
    while True:
        response = fake_api(page, call_log=call_log)
        records = response["results"]
        if not records:
            return
        yield from records
        page += 1

#Exercise 2.7

class Resource:
    """A simple iterator-backed resource.

    Example:
        >>> resource = Resource(3)
        >>> next(resource)
        0
    """

    def __init__(self, size: int) -> None:
        self.data: Iterator[int] = iter(range(size))

    def open(self) -> None:
        print("Resource is open")

    def close(self) -> None:
        print("Closing resource")

    def __iter__(self) -> Iterator[int]:
        return self

    def __next__(self) -> int:
        return next(self.data)

def OpenCloseGenerator(size: int) -> Iterator[int]:
    """Yield values from a resource, closing it when done.

    Example:
        >>> list(islice(OpenCloseGenerator(2), 2))
        [0, 1]
    """
    resource = Resource(size)
    resource.open()
    try:
        yield from resource
    finally:
        resource.close()

closed = []
class TrackedResource(Resource):
    def close(self):
        closed.append(True)
        super().close()

def gen_with_finally(size):
    r = TrackedResource(size)
    try:
        yield from r
    finally:
        r.close()

def gen_without_finally(size):
    r = TrackedResource(size)
    yield from r  # without finally

def main() -> None:
    BASE_DIR = Path(__file__).parent
    CSV_PATH = BASE_DIR / "data" / "sales.csv"

    source = read_csv_rows(CSV_PATH)
    for row in source:
        print(row)
    # Second time won't print anything since the generator is already exhausted
    for row in source:
        print(row)

    # Expected behavior before running:
    # next() 1: prints "initiating", returns 1
    # next() 2: prints "continuing", returns 2
    # next() 3: prints "finalizing", returns 3
    tracking_gen = test_generator()
    next(tracking_gen)
    next(tracking_gen)
    next(tracking_gen)

    take_test = take(naturals(), 5)
    for i in take_test:
        print(i)

    drop_test = drop(naturals(), 10)
    print(next(drop_test))

    run_pipeline(CSV_PATH)
    assert len(saved) == 6, f"BUG: expected 7, got {len(saved)}"

    flat_list = flatten_deep(["ab", ["cd"]])
    for item in flat_list:
        print(item)

    calls: list[int] = []
    gen = fetch_all(call_log=calls)

    assert calls == [], "no calls should happen yet"
    result = list(islice(gen, 2))
    assert result == [0, 1]
    assert calls == [1], f"expecting 1 call, had {len(calls)}: {calls}"


    for i, gen in enumerate(gen_with_finally(10)):
        if i == 2:
            break
    #assert closed == [True], "close() should have been called even with break"

    closed.clear()
    for i, gen in enumerate(gen_without_finally(10)):
        if i == 2:
            break
    # closed stays empty here — GC may eventually close it, but that is not guaranteed or immediate


if __name__ == "__main__":
    main()