export interface Snippet {
  id: string
  name: string
  description: string
  code: string
}

export const EXAMPLES: Snippet[] = [
  {
    id: 'hello',
    name: 'Hello, World',
    description: 'The classic first program.',
    code: `# Welcome to PyRunner — a fast Python playground.
# Press Run (or Ctrl+Enter) to execute.

print("Hello, World!")
print("Python is running on the server.")
`,
  },
  {
    id: 'pyramid',
    name: 'Pyramid Pattern',
    description: 'Test whitespace preservation with leading spaces.',
    code: `# Whitespace test — leading spaces must be preserved exactly.
# Each line of the pyramid starts with several spaces before the *.

n = 8
for i in range(1, n + 1):
    # 2*(n-i) leading spaces, then (2*i - 1) stars
    print(" " * (2 * (n - i)) + "* " * (2 * i - 1))

# Tab character test (should render as 4 columns wide)
print("\\nTab demo:")
print("a\\tb\\tc")
print("1\\t2\\t3")

# Multiple consecutive spaces test
print("\\nConsecutive spaces:")
print("X" + " " * 10 + "X")
print("Y" + " " * 20 + "Y")
`,
  },
  {
    id: 'interactive',
    name: 'Interactive Input',
    description: 'Type your answers when prompted.',
    code: `# This script asks for your name and age.
# When you press Run, the prompts will appear
# in the console — just type and hit Enter.

name = input("What's your name? ")
age = int(input("How old are you? "))

print(f"\\nHello, {name}!")
print(f"In 10 years you'll be {age + 10}.")

# Ask a few more questions interactively
favorite = input("\\nWhat's your favorite color? ")
print(f"{favorite.capitalize()}? Great choice!")
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
    id: 'guess',
    name: 'Number Guessing Game',
    description: 'A mini REPL — guess until you win.',
    code: `import random

print("I'm thinking of a number between 1 and 100.")
target = random.randint(1, 100)
attempts = 0

while True:
    guess = input("Your guess: ")
    try:
        g = int(guess)
    except ValueError:
        print("  Please enter a valid integer.")
        continue

    attempts += 1
    if g < target:
        print(f"  {g} is too low. Try again.")
    elif g > target:
        print(f"  {g} is too high. Try again.")
    else:
        print(f"  You got it in {attempts} attempts!")
        break
`,
  },
  {
    id: 'errors',
    name: 'Error Handling',
    description: 'See how Python tracebacks appear in the console.',
    code: `def divide(a, b):
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b

print(divide(10, 2))

try:
    print(divide(5, 0))
except ValueError as e:
    print(f"Caught: {e}")

# This one is uncaught — the traceback will appear in the console.
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
  {
    id: 'matplotlib-line',
    name: 'Matplotlib: Line Plot',
    description: 'Inline chart rendered as PNG in the console.',
    code: `# Matplotlib figures render INLINE in the console!
# plt.show() emits the figure as a PNG image.

import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 4 * np.pi, 200)
y_sin = np.sin(x)
y_cos = np.cos(x)

fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(x, y_sin, label="sin(x)", linewidth=2)
ax.plot(x, y_cos, label="cos(x)", linewidth=2, linestyle="--")
ax.set_title("Sine & Cosine Waves", fontsize=13)
ax.set_xlabel("x")
ax.set_ylabel("amplitude")
ax.legend()
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.show()
print("Plot rendered above.")
`,
  },
  {
    id: 'matplotlib-bar',
    name: 'Matplotlib: Bar Chart',
    description: 'Bar chart with categories and colors.',
    code: `import matplotlib.pyplot as plt

languages = ["Python", "JavaScript", "Rust", "Go", "TypeScript"]
popularity = [89, 67, 12, 18, 35]
colors = ["#4ade80", "#fbbf24", "#f87171", "#60a5fa", "#c084fc"]

fig, ax = plt.subplots(figsize=(8, 4))
bars = ax.bar(languages, popularity, color=colors, edgecolor="black", linewidth=0.5)

# Annotate each bar with its value
for bar, value in zip(bars, popularity):
    ax.text(
        bar.get_x() + bar.get_width() / 2,
        bar.get_height() + 1.5,
        f"{value}",
        ha="center",
        va="bottom",
        fontsize=10,
        fontweight="bold",
    )

ax.set_title("Programming Language Popularity (2026)")
ax.set_ylabel("Score")
ax.set_ylim(0, 100)
ax.grid(axis="y", alpha=0.3)

plt.tight_layout()
plt.show()
`,
  },
  {
    id: 'matplotlib-subplots',
    name: 'Matplotlib: Subplots',
    description: 'Multiple plots in one figure.',
    code: `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 10, 100)

fig, axes = plt.subplots(2, 2, figsize=(9, 6))

axes[0, 0].plot(x, np.sin(x), color="#4ade80")
axes[0, 0].set_title("sin(x)")

axes[0, 1].plot(x, np.cos(x), color="#fbbf24")
axes[0, 1].set_title("cos(x)")

axes[1, 0].plot(x, x**2, color="#f87171")
axes[1, 0].set_title("x²")

axes[1, 1].hist(np.random.randn(1000), bins=30, color="#60a5fa", edgecolor="black")
axes[1, 1].set_title("Normal distribution")

for ax in axes.flat:
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.show()
`,
  },
  {
    id: 'flask-hello',
    name: 'Flask: Hello API',
    description: 'Run a Flask server and open the link.',
    code: `# A minimal Flask web server.
# When you press Run, a clickable link will appear in
# the console — click it to open your API in a new tab.

from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def home():
    return jsonify({
        "message": "Hello from Flask!",
        "endpoints": ["/", "/users", "/greet/Alice"],
    })

@app.route("/users")
def users():
    return jsonify([
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"},
        {"id": 3, "name": "Charlie"},
    ])

@app.route("/greet/<name>")
def greet(name):
    return jsonify({"greeting": f"Hello, {name}!"})

if __name__ == "__main__":
    # Use port 5555 so it doesn't clash with the runner
    app.run(host="127.0.0.1", port=5555, debug=False)
`,
  },
  {
    id: 'flask-html',
    name: 'Flask: HTML Page',
    description: 'Serve an HTML page with templates.',
    code: `# Flask serving an inline HTML page.
# Click the link in the console to view it.

from flask import Flask, render_template_string

app = Flask(__name__)

HTML = """
<!DOCTYPE html>
<html>
<head>
  <title>Flask Demo</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif;
           background: linear-gradient(135deg, #667eea, #764ba2);
           color: white; min-height: 100vh; margin: 0;
           display: flex; align-items: center; justify-content: center; }
    .card { background: rgba(255,255,255,0.15); padding: 2rem 3rem;
            border-radius: 16px; backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
    h1 { margin: 0 0 0.5rem; font-size: 2rem; }
    p { margin: 0; opacity: 0.9; }
    code { background: rgba(0,0,0,0.3); padding: 2px 6px;
           border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello from Flask! 🐍</h1>
    <p>Rendered with <code>render_template_string</code></p>
  </div>
</body>
</html>
"""

@app.route("/")
def home():
    return render_template_string(HTML)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5556, debug=False)
`,
  },
  {
    id: 'http-server',
    name: 'Python: http.server',
    description: 'Stdlib HTTP server (no Flask needed).',
    code: `# Python's built-in HTTP server. No external library needed.
# Click the link in the console to open it.

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import json


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse the path so query params (like ?XTransformPort=5557 added by
        # the gateway) are ignored when matching routes.
        path = urlparse(self.path).path
        if path == "/":
            body = json.dumps({
                "message": "Hello from http.server!",
                "path": path,
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/time":
            from datetime import datetime
            body = json.dumps({"now": datetime.now().isoformat()}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


httpd = HTTPServer(("127.0.0.1", 5557), Handler)
# Print this exact line so PyRunner detects the server and cancels the timeout.
print(f" * Running on http://127.0.0.1:5557/")
httpd.serve_forever()
`,
  },
]
