from collections.abc import Iterator
# In most cases, a generator function should be annotated as returning `Iterator[T]` rather than `Generator[T, S, R]`, because it exposes only the behavior that its consumers actually need. This follows the principle of programming to abstractions, not implementations.
from pathlib import Path
import sys

def read_csv_rows(path) -> Iterator[str]:
    """Iterable Csv Reader"""

    #This version of the implementation is much shorter, but can not be reused. if read_csv_rows("x.csv") is called 2 times, then each instance will be able to be used 1 time
    
    f = open(path, encoding='utf-8')
    columns = next(f).strip('\n').split(',')
    for line in f:
        yield dict(zip(columns, line.strip('\n').split(',')))

def test_generator() -> Iterator[int]:
    print("initiating")
    yield 1
    print("continuing")
    yield 2
    print("finalizing")
    yield 3

def naturals():

    count = 1
    
    while True:
        yield count
        count += 1


def take(iterable, n): 

    it = iter(iterable)

    for _ in range(n):
        yield next(it)
    

def drop(iterable, n): 

    it = iter(iterable)

    for _ in range(n):
        next(it)

    yield from it


def main():

    BASE_DIR = Path(__file__).parent         
    CSV_PATH = BASE_DIR / "data" / "sales.csv"

    source = read_csv_rows(CSV_PATH)
    for row in source:      
        print(row)
    #Second time won't print anything since the generator is already exhausted        
    for row in source:      
        print(row)

    tracking_gen = test_generator()

    next(tracking_gen) #Expected result: prints "Initiating", returns 1
    next(tracking_gen) #Expected result: prints "continuing", returns 2
    next(tracking_gen) #Expected result: prints "finalizing", returns 3

    #Exercise 2.3: testing take and drop

    take_test = take(naturals(), 5)

    for i in take_test:
        print(i)            #Expected result: print 1 to 5 

    drop_test = drop(naturals(), 10)

    print(next(drop_test)) #Expected result: 11


if __name__ == "__main__": main()