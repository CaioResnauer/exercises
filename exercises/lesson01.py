from pathlib import Path
import sys


def manual_for(iterable, action):
    """
    A manual implementation of a for loop that applies an action to each item in an iterable.

    Parameters:
    iterable: An iterable object (like a list, tuple, or string).
    action: A function that takes one argument and performs an action on it.

    Returns:
    None
    """
    iterator = iter(iterable)  # Get an iterator from the iterable

    while True: 
        try:
            item = next(iterator)
        except StopIteration:
            break
        action(item)

def is_iterator(obj) -> bool:
    """Return True if obj is an iterator and not just an iterable"""
    return hasattr(obj, "__next__") and iter(obj) is obj



class CsvSource:
    """Iterable Csv Reader"""
    def __init__(self, path: str):
        self.path = path

    def __iter__(self):
        return CsvSourceIterator(self.path)

class CsvSourceIterator:
    """Iterator for CsvSource class"""
    
    def __init__(self, path):
        self.f = open(path, encoding="utf-8")
        self.columns = next(self.f).rstrip('\n').split(',')

    def __iter__(self):
        return self

    def __next__(self):
        values = next(self.f).rstrip('\n').split(',')
        return (dict(zip(self.columns,values)))

# Exercise 1.4 - fixing the class

class Repeater:
    def __init__(self, values):
        self.values = values
        self.index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.index >= len(self.values):
            raise StopIteration
        value = self.values[self.index]
        self.index += 1
        return value

# a) The class fails because it's being implemented as an iterator, instead of an iterable that creates iterators.  
#   so, after iterating on an instance for the first time, the iteration does not work again  

class FixedRepeater:
    """Fixed version of Repeater class"""
    def __init__(self, values):
        self.values = values

    def __iter__(self):
        return RepeaterIterator(self.values)

class RepeaterIterator:
    """Iterator for FixedRepeater class"""

    def __init__(self, values):
        self.values = values
        self.index = 0
        
    def __iter__(self):
        return self
        
    def __next__(self):
        if self.index >= len(self.values):
            raise StopIteration
        value = self.values[self.index]
        self.index += 1
        return value

class Chunked:
    """Iterable that produces lists of maximum size from a given iterable 
    
    expected result: list(Chunked([1,2,3,4,5], 2))   # [[1,2], [3,4], [5]]
    """

    def __init__(self, iterable, size):
        self.iterable = iterable
        self.size = size

    def __iter__(self):
        return ChunkedIterator(self.iterable, self.size)

class ChunkedIterator:
    """ Iterator for class Chunked """

    def __init__(self, iterable, size):
        self.iterable = iterable
        self.iterator = iter(iterable)
        self.size = size
        self.index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.index >= len(self.iterable):
            raise StopIteration
        list=[]
        for i in range(self.size):
            try:
                list.append(next(self.iterator))
                self.index += 1
            except StopIteration: break
        return list

def main():

    print ('Testing if is_iterator function works correctly')
    print("is_iterator([1,2,3]) - Esperado: False | Real: " + str(is_iterator([1,2,3])))
    print("is_iterator(iter([1,2,3])) - Esperado: True | Real: " + str(is_iterator(iter([1,2,3]))))
    print("is_iterator(\"texto\") - Esperado: False | Real: " + str(is_iterator("texto")))
    print("is_iterator(range(3)) - Esperado: True | Real: " + str(is_iterator(range(3))))
    print("is_iterator((x for x in range(3))) - Esperado: True | Real: " + str(is_iterator((x for x in range(3)))))
    print("is_iterator(open(__file__)) - Esperado: True | Real: " + str(is_iterator(open(__file__))))

    BASE_DIR = Path(__file__).parent          
    CSV_PATH = BASE_DIR / "data" / "sales.csv"

    source = CsvSource(CSV_PATH)
    for row in source:      
        print(row)
    for row in source:      
        print(row)


    broken = Repeater([1, 2, 3])
    assert list(broken) == [1, 2, 3], "first pass should work"
    assert list(broken) == [], "BUG: iterator is exhausted, second pass yields nothing"

    
    test_2 = FixedRepeater([1,2,3])

    print(list(test_2))
    print(list(test_2))

    print("size of list with 1000000 indexes: " + str(sys.getsizeof(list(range(1_000_000)))))
    print("size of range(1000000): " + str(sys.getsizeof(range(1_000_000))))
    print("size of (x for x in range(1_000_000)): " + str(sys.getsizeof((x for x in range(1_000_000)))))

    # sys.getsizeof() can be misleading when measuring a generator because it will return the size in memory of the iterator object, not the list of 
    # values it will generate.

    print(list(Chunked([1,2,3,4,5], 2))) # expected: [[1,2], [3,4], [5]]

if __name__ == "__main__": main()



        
