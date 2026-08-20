export interface Snippet {
  id: string
  name: string
  description: string
  code: string
  stdin?: string
}

export const EXAMPLES: Snippet[] = [
  {
    id: 'hello',
    name: 'Hello, World',
    description: 'The classic first program.',
    code: `# Welcome to PyRunner — a fast Python playground.
# Press the Run button (or Ctrl+Enter) to execute.

print("Hello, World!")
print("Python is running on the server.")
`,
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci',
    description: 'Generate Fibonacci numbers with a generator.',
    code: `def fib(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print("First 15 Fibonacci numbers:")
print(", ".join(str(n) for n in fib(15)))

# Golden ratio approximation from the last pair
a, b = list(fib(30))[-2:]
print(f"\\nApprox golden ratio from F(29)/F(28): {b/a:.10f}")
`,
  },
  {
    id: 'stdin',
    name: 'Stdin Demo',
    description: 'Reads input from the Stdin tab.',
    code: `name = input("What's your name? ")
age = int(input("How old are you? "))

print(f"\\nHello, {name}!")
print(f"In 10 years you'll be {age + 10}.")

# Read remaining lines
print("\\n--- lines from stdin ---")
try:
    while True:
        line = input()
        if not line:
            break
        print(f"  > {line}")
except EOFError:
    pass
`,
    stdin: 'Ada\n36\nline one\nline two\nline three',
  },
  {
    id: 'classes',
    name: 'OOP Demo',
    description: 'Classes, inheritance, and dunder methods.',
    code: `from dataclasses import dataclass
from typing import List

@dataclass
class Animal:
    name: str
    sound: str

    def speak(self) -> str:
        return f"{self.name} says {self.sound}"

class Dog(Animal):
    def __init__(self, name: str):
        super().__init__(name, "Woof")

    def fetch(self) -> str:
        return f"{self.name} fetches the ball!"

animals: List[Animal] = [
    Animal("Cat", "Meow"),
    Dog("Rex"),
    Animal("Cow", "Moo"),
]

for a in animals:
    print(a.speak())

print(animals[1].fetch())
`,
  },
  {
    id: 'primes',
    name: 'Sieve of Eratosthenes',
    description: 'List primes below 100 using the sieve.',
    code: `def sieve(n: int):
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    for i in range(2, int(n**0.5) + 1):
        if is_prime[i]:
            for j in range(i*i, n + 1, i):
                is_prime[j] = False
    return [i for i, p in enumerate(is_prime) if p]

primes = sieve(100)
print(f"Found {len(primes)} primes below 100:")
print(primes)
`,
  },
  {
    id: 'listcomp',
    name: 'List Comprehensions',
    description: 'Concise functional-style data transforms.',
    code: `numbers = range(1, 11)

squares = [n * n for n in numbers]
evens = [n for n in numbers if n % 2 == 0]
cube_map = {n: n**3 for n in numbers}

print("squares:", squares)
print("evens:  ", evens)
print("cubes:  ", cube_map)

# Transpose a matrix
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
transposed = [[row[i] for row in matrix] for i in range(len(matrix[0]))]
print("transposed:")
for row in transposed:
    print(" ", row)
`,
  },
  {
    id: 'errors',
    name: 'Error Handling',
    description: 'See how Python tracebacks appear in the output.',
    code: `def divide(a, b):
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b

print(divide(10, 2))

try:
    print(divide(5, 0))
except ValueError as e:
    print(f"Caught: {e}")

# This one is uncaught — the traceback will appear in stderr.
print(divide(1, 0))
print("This line never runs.")
`,
  },
  {
    id: 'json',
    name: 'JSON & Dataclasses',
    description: 'Serialize and pretty-print structured data.',
    code: `import json
from dataclasses import dataclass, asdict
from datetime import datetime

@dataclass
class Task:
    title: str
    done: bool = False
    created: str = ""

tasks = [
    Task("Write code", True, "2026-08-01"),
    Task("Ship it",    False, "2026-08-15"),
    Task("Rest",       False, "2026-08-20"),
]

data = {
    "owner": "you",
    "count": len(tasks),
    "tasks": [asdict(t) for t in tasks],
    "exported_at": datetime.now().isoformat(timespec="seconds"),
}

print(json.dumps(data, indent=2))
`,
  },
]
