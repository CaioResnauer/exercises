from pathlib import Path


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
    """
    Return True if obj is an iterator and not just an iterable
    """
    return hasattr(obj, "__next__") and iter(obj) is obj



class CsvSource:
    """ Iterable Csv Reader """
    def __init__(self, path: str):
        self.path = path

    def __iter__(self):
        return CsvSourceIterator(self.path)

class CsvSourceIterator:
    """ Iterator for CsvSource class """
    
    def __init__(self, path):
        self.f = open(path, encoding="utf-8")
        self.columns = next(self.f).rstrip('\n').split(',')

    def __iter__(self):
        return self

    def __next__(self):
        values = next(self.f).rstrip('\n').split(',')
        return (dict(zip(self.columns,values)))

def main():

    print ('Tesing if is_iterator function works correctly')
    print("is_iterator([1,2,3]) - Esperado: False | Real: " + str(is_iterator([1,2,3])))
    print("is_iterator(iter([1,2,3])) - Esperado: True | Real: " + str(is_iterator(iter([1,2,3]))))
    print("is_iterator(\"texto\") - Esperado: False | Real: " + str(is_iterator("texto")))
    print("is_iterator(range(3)) - Esperado: True | Real: " + str(is_iterator(range(3))))
    print("is_iterator((x for x in range(3))) - Esperado: True | Real: " + str(is_iterator((x for x in range(3)))))
    print("is_iterator(open(__file__)) - Esperado: True | Real: " + str(is_iterator(open(__file__))))

    BASE_DIR = Path(__file__).parent          # pasta onde este .py está
    CSV_PATH = BASE_DIR / "data" / "sales.csv"

    source = CsvSource(CSV_PATH)
    for row in source:      # cada row é um dict {coluna: valor}
        print(row)
    for row in source:      # DEVE funcionar de novo, do começo
        print(row)


main()




        
