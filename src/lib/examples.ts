export interface Snippet {
  id: string
  name: string
  description: string
  code: string
  language?: 'python' | 'java' | 'c' | 'cpp' | 'r'
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
  {
    id: 'requests-get',
    name: 'requests: GET JSON',
    description: 'Fetch JSON from a public API.',
    code: `# The 'requests' library is pre-installed.
# Use it to fetch data from any public HTTP API.

import requests

# httpbin.org is a free service for testing HTTP requests
response = requests.get("https://httpbin.org/json")
print(f"Status: {response.status_code}")
print(f"Content-Type: {response.headers.get('Content-Type')}")

data = response.json()
print(f"\\nParsed JSON:")
print(f"  Title:  {data['slideshow']['title']}")
print(f"  Author: {data['slideshow']['author']}")
print(f"  Slides: {len(data['slideshow']['slides'])}")
`,
  },
  {
    id: 'requests-headers',
    name: 'requests: Headers & Auth',
    description: 'Custom headers, query params, and basic auth.',
    code: `import requests

# Custom headers (e.g. User-Agent, Authorization)
headers = {
    "User-Agent": "PyRunner/1.0",
    "Accept": "application/json",
}

# Query parameters
params = {
    "foo": "bar",
    "baz": "42",
}

# Basic auth
auth = ("user", "passwd")

response = requests.get(
    "https://httpbin.org/get",
    headers=headers,
    params=params,
    auth=auth,
    timeout=10,
)

print(f"Status: {response.status_code}")
print(f"Final URL: {response.url}")

data = response.json()
print(f"\\nSent headers:")
for k, v in data["headers"].items():
    print(f"  {k}: {v}")

print(f"\\nSent query params:")
for k, v in data["args"].items():
    print(f"  {k}: {v}")
`,
  },
  {
    id: 'requests-post',
    name: 'requests: POST JSON',
    description: 'Send JSON body and inspect the response.',
    code: `import requests
import json

# POST a JSON body to httpbin.org — it echoes it back
payload = {
    "user": {"name": "Ada", "age": 36},
    "tags": ["python", "math", "computing"],
    "active": True,
}

response = requests.post(
    "https://httpbin.org/post",
    json=payload,
    timeout=10,
)

print(f"Status: {response.status_code}")
print(f"Server: {response.headers.get('Server')}")

# httpbin echoes back what we sent
echoed = response.json()
print(f"\\nEchoed JSON body:")
print(json.dumps(echoed["json"], indent=2))

# The response text
print(f"\\nResponse time: {response.elapsed.total_seconds() * 1000:.0f} ms")
`,
  },
  {
    id: 'requests-pandas',
    name: 'requests + pandas',
    description: 'Fetch CSV and analyze with pandas.',
    code: `# Combine 'requests' (HTTP) with 'pandas' (data analysis).
# Fetch a CSV from a URL and load it directly into a DataFrame.

import io
import requests
import pandas as pd

# Famous Iris dataset (CSV format, served from a public URL)
url = "https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv"
response = requests.get(url, timeout=10)
print(f"Downloaded {len(response.content)} bytes from {response.url}")

# Load directly from the response bytes
df = pd.read_csv(io.StringIO(response.text))

print(f"\\nShape: {df.shape[0]} rows × {df.shape[1]} columns")
print(f"\\nColumns: {list(df.columns)}")

print(f"\\nFirst 5 rows:")
print(df.head().to_string())

print(f"\\nSummary statistics:")
print(df.describe().to_string())

print(f"\\nMean by species:")
print(df.groupby("species").mean(numeric_only=True).to_string())
`,
  },
  {
    id: 'java-hello',
    name: 'Java: Hello World',
    description: 'Classic first Java program.',
    language: 'java',
    code: `// Welcome to PyRunner — Java 21 playground.
// Press Run (or Ctrl/Cmd+Enter) to execute.

public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        System.out.println("Java is running on the server.");

        // Iterate and print
        for (int i = 1; i <= 5; i++) {
            System.out.println("Count: " + i);
        }
    }
}
`,
  },
  {
    id: 'java-interactive',
    name: 'Java: Interactive Input',
    description: 'Read from stdin with Scanner.',
    language: 'java',
    code: `// This program reads input from the console.
// When you press Run, the prompt will appear in
// the console — type your answer and press Enter.

import java.util.Scanner;

public class Interactive {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.print("What's your name? ");
        String name = scanner.nextLine();

        System.out.print("How old are you? ");
        int age = Integer.parseInt(scanner.nextLine().trim());

        System.out.println();
        System.out.println("Hello, " + name + "!");
        System.out.println("In 10 years you'll be " + (age + 10) + ".");

        scanner.close();
    }
}
`,
  },
  {
    id: 'java-fizzbuzz',
    name: 'Java: FizzBuzz',
    description: 'Classic FizzBuzz with a twist.',
    language: 'java',
    code: `// Classic FizzBuzz problem.
// Print numbers 1 to 30, but:
//   - multiples of 3 → "Fizz"
//   - multiples of 5 → "Buzz"
//   - multiples of both → "FizzBuzz"

public class FizzBuzz {
    public static void main(String[] args) {
        for (int i = 1; i <= 30; i++) {
            if (i % 15 == 0) {
                System.out.println("FizzBuzz");
            } else if (i % 3 == 0) {
                System.out.println("Fizz");
            } else if (i % 5 == 0) {
                System.out.println("Buzz");
            } else {
                System.out.println(i);
            }
        }
    }
}
`,
  },
  {
    id: 'java-fibonacci',
    name: 'Java: Fibonacci',
    description: 'Generate Fibonacci numbers.',
    language: 'java',
    code: `// Generate the first 20 Fibonacci numbers using a
// memoized recursive approach with an array cache.

public class Fibonacci {
    public static void main(String[] args) {
        int n = 20;
        long[] fib = new long[n];
        fib[0] = 0;
        fib[1] = 1;

        System.out.println("First " + n + " Fibonacci numbers:");
        System.out.print(fib[0] + ", " + fib[1]);

        for (int i = 2; i < n; i++) {
            fib[i] = fib[i - 1] + fib[i - 2];
            System.out.print(", " + fib[i]);
        }
        System.out.println();

        // Golden ratio approximation
        double ratio = (double) fib[n - 1] / fib[n - 2];
        System.out.printf("%nApprox golden ratio F(%d)/F(%d): %.10f%n",
            n - 1, n - 2, ratio);
    }
}
`,
  },
  {
    id: 'java-arraylist',
    name: 'Java: ArrayList & Streams',
    description: 'Modern Java with collections and streams.',
    language: 'java',
    code: `// Modern Java 21 with ArrayList, lambdas, and streams.

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class CollectionDemo {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>(List.of(
            "Alice", "Bob", "Charlie", "Diana", "Eve",
            "Frank", "Grace", "Heidi"
        ));

        System.out.println("All names (" + names.size() + "):");
        names.forEach(System.out::println);

        // Filter names longer than 4 characters, sorted
        List<String> longNames = names.stream()
            .filter(n -> n.length() > 4)
            .sorted()
            .collect(Collectors.toList());

        System.out.println("\\nNames longer than 4 chars (sorted):");
        longNames.forEach(System.out::println);

        // Map to uppercase, join with commas
        String joined = names.stream()
            .map(String::toUpperCase)
            .collect(Collectors.joining(", "));
        System.out.println("\\nUppercase joined:");
        System.out.println(joined);

        // Total character count
        int totalChars = names.stream()
            .mapToInt(String::length)
            .sum();
        System.out.println("\\nTotal characters across all names: " + totalChars);
    }
}
`,
  },
  {
    id: 'java-error',
    name: 'Java: Compile Error',
    description: 'See how javac errors appear in the console.',
    language: 'java',
    code: `// This file has a deliberate compile error.
// The runner will show the javac error messages
// in the console so you can see the format.

public class Broken {
    public static void main(String[] args) {
        // Typo: 'Syste' instead of 'System'
        Syste.out.println("This won't compile");

        // Type mismatch
        int x = "hello";
    }
}
`,
  },
  {
    id: 'c-hello',
    name: 'C: Hello World',
    description: 'Classic first C program with printf.',
    language: 'c',
    code: `// Welcome to PyRunner — C (gcc 14) playground.
// Compiled with: gcc -std=c11 -Wall -O2 -lm
// Press Run (or Ctrl/Cmd+Enter) to execute.

#include <stdio.h>

int main(void) {
    printf("Hello, World!\\n");
    printf("C is running on the server.\\n");

    // Simple loop
    for (int i = 1; i <= 5; i++) {
        printf("Count: %d\\n", i);
    }

    return 0;
}
`,
  },
  {
    id: 'c-interactive',
    name: 'C: Interactive Input',
    description: 'Read from stdin with scanf.',
    language: 'c',
    code: `// This program reads input from the console.
// When you press Run, the prompt will appear in
// the console — type your answer and press Enter.

#include <stdio.h>

int main(void) {
    char name[64];
    int age;

    printf("What's your name? ");
    scanf("%63s", name);

    printf("How old are you? ");
    scanf("%d", &age);

    printf("\\nHello, %s!\\n", name);
    printf("In 10 years you'll be %d.\\n", age + 10);

    return 0;
}
`,
  },
  {
    id: 'c-fizzbuzz',
    name: 'C: FizzBuzz',
    description: 'Classic FizzBuzz with printf formatting.',
    language: 'c',
    code: `// Classic FizzBuzz problem in C.
// Print numbers 1 to 30 with Fizz/Buzz/FizzBuzz rules.

#include <stdio.h>

int main(void) {
    for (int i = 1; i <= 30; i++) {
        if (i % 15 == 0) {
            printf("FizzBuzz\\n");
        } else if (i % 3 == 0) {
            printf("Fizz\\n");
        } else if (i % 5 == 0) {
            printf("Buzz\\n");
        } else {
            printf("%d\\n", i);
        }
    }
    return 0;
}
`,
  },
  {
    id: 'c-fibonacci',
    name: 'C: Fibonacci',
    description: 'Generate Fibonacci numbers with arrays.',
    language: 'c',
    code: `// Generate the first 20 Fibonacci numbers.
// Uses an array for memoization and math.h for the
// golden ratio approximation.

#include <stdio.h>
#include <math.h>

int main(void) {
    int n = 20;
    long long fib[20];
    fib[0] = 0;
    fib[1] = 1;

    printf("First %d Fibonacci numbers:\\n", n);
    printf("%lld, %lld", fib[0], fib[1]);

    for (int i = 2; i < n; i++) {
        fib[i] = fib[i - 1] + fib[i - 2];
        printf(", %lld", fib[i]);
    }
    printf("\\n");

    // Golden ratio approximation
    double ratio = (double)fib[n - 1] / fib[n - 2];
    printf("\\nApprox golden ratio F(%d)/F(%d): %.10f\\n",
           n - 1, n - 2, ratio);

    return 0;
}
`,
  },
  {
    id: 'c-structs',
    name: 'C: Structs & Pointers',
    description: 'Define structs, use pointers, malloc/free.',
    language: 'c',
    code: `// Modern C with structs, pointers, and dynamic memory.
// Demonstrates typedef, malloc, and pointer arithmetic.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[32];
    int age;
    float gpa;
} Student;

void print_student(const Student *s) {
    printf("  %s — age %d, GPA %.2f\\n", s->name, s->age, s->gpa);
}

int compare_by_age(const void *a, const void *b) {
    const Student *sa = (const Student *)a;
    const Student *sb = (const Student *)b;
    return sa->age - sb->age;
}

int main(void) {
    int count = 4;
    Student *students = malloc(count * sizeof(Student));
    if (!students) return 1;

    strcpy(students[0].name, "Alice");    students[0].age = 20; students[0].gpa = 3.8;
    strcpy(students[1].name, "Bob");      students[1].age = 22; students[1].gpa = 3.2;
    strcpy(students[2].name, "Charlie");  students[2].age = 19; students[2].gpa = 3.9;
    strcpy(students[3].name, "Diana");    students[3].age = 21; students[3].gpa = 3.7;

    printf("Students (unsorted):\\n");
    for (int i = 0; i < count; i++) print_student(&students[i]);

    // Sort by age using qsort
    qsort(students, count, sizeof(Student), compare_by_age);

    printf("\\nStudents (sorted by age):\\n");
    for (int i = 0; i < count; i++) print_student(&students[i]);

    // Compute average GPA
    float sum = 0;
    for (int i = 0; i < count; i++) sum += students[i].gpa;
    printf("\\nAverage GPA: %.2f\\n", sum / count);

    free(students);
    return 0;
}
`,
  },
  {
    id: 'c-pointers',
    name: 'C: Pointers & Arrays',
    description: 'Pointer arithmetic and array manipulation.',
    language: 'c',
    code: `// Demonstrate pointer arithmetic and array passing.

#include <stdio.h>

// Pass array as pointer + length
int sum_array(const int *arr, int len) {
    int total = 0;
    for (int i = 0; i < len; i++) {
        total += *arr++;  // pointer arithmetic
    }
    return total;
}

// Reverse an array in place using two pointers
void reverse_array(int *begin, int *end) {
    while (begin < end) {
        int tmp = *begin;
        *begin = *end;
        *end = tmp;
        begin++;
        end--;
    }
}

int main(void) {
    int arr[] = {10, 20, 30, 40, 50, 60, 70, 80};
    int len = sizeof(arr) / sizeof(arr[0]);

    printf("Original array: ");
    for (int i = 0; i < len; i++) printf("%d ", arr[i]);
    printf("\\n");

    printf("Sum: %d\\n", sum_array(arr, len));
    printf("Average: %.2f\\n", (double)sum_array(arr, len) / len);

    // Reverse using pointers
    reverse_array(arr, arr + len - 1);

    printf("Reversed array: ");
    for (int i = 0; i < len; i++) printf("%d ", arr[i]);
    printf("\\n");

    return 0;
}
`,
  },
  {
    id: 'c-error',
    name: 'C: Compile Error',
    description: 'See how gcc errors appear in the console.',
    language: 'c',
    code: `// This file has deliberate compile errors.
// The runner will show gcc error messages
// in the console so you can see the format.

#include <stdio.h>

int main(void) {
    // Using undeclared variable
    printf("Value: %d\\n", x);

    // Type mismatch — assigning string to int
    int y = "hello";

    // Missing semicolon
    int z = 42

    return 0;
}
`,
  },
  {
    id: 'cpp-hello',
    name: 'C++: Hello World',
    description: 'Classic first C++ program with iostream.',
    language: 'cpp',
    code: `// Welcome to PyRunner — C++ (g++ 14, C++20) playground.
// Compiled with: g++ -std=c++20 -Wall -O2
// Press Run (or Ctrl/Cmd+Enter) to execute.

#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::cout << "Hello, World!" << std::endl;

    // Range-based for loop with auto
    std::vector<int> nums = {5, 2, 8, 1, 9, 3};
    std::sort(nums.begin(), nums.end());

    std::cout << "Sorted: ";
    for (auto n : nums) {
        std::cout << n << " ";
    }
    std::cout << std::endl;

    return 0;
}
`,
  },
  {
    id: 'cpp-interactive',
    name: 'C++: Interactive Input',
    description: 'Read from stdin with getline and cin.',
    language: 'cpp',
    code: `// This program reads input from the console.
// When you press Run, the prompt will appear in
// the console — type your answer and press Enter.

#include <iostream>
#include <string>
#include <limits>

int main() {
    std::string name;
    int age;

    std::cout << "What's your name? ";
    std::getline(std::cin, name);

    std::cout << "How old are you? ";
    std::cin >> age;
    // Clear the newline left in the buffer after cin >> age
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\\n');

    std::cout << "\\nHello, " << name << "!" << std::endl;
    std::cout << "In 10 years you'll be " << age + 10 << "." << std::endl;

    // Read a favorite color
    std::string color;
    std::cout << "\\nWhat's your favorite color? ";
    std::getline(std::cin, color);
    std::cout << color << "? Great choice!" << std::endl;

    return 0;
}
`,
  },
  {
    id: 'cpp-stl',
    name: 'C++: STL Containers',
    description: 'Vectors, maps, sets, and algorithms.',
    language: 'cpp',
    code: `// Modern C++ with STL containers and algorithms.
// Demonstrates vector, map, set, and range-based for loops.

#include <iostream>
#include <vector>
#include <map>
#include <set>
#include <algorithm>
#include <string>

int main() {
    // Vector with iterator-based operations
    std::vector<int> nums = {3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5};
    std::cout << "Original: ";
    for (auto n : nums) std::cout << n << " ";
    std::cout << std::endl;

    // Sort and remove duplicates
    std::sort(nums.begin(), nums.end());
    nums.erase(std::unique(nums.begin(), nums.end()), nums.end());
    std::cout << "Sorted unique: ";
    for (auto n : nums) std::cout << n << " ";
    std::cout << std::endl;

    // Map (sorted key-value store)
    std::map<std::string, int> ages;
    ages["Alice"] = 30;
    ages["Bob"] = 25;
    ages["Charlie"] = 35;
    ages["Diana"] = 28;

    std::cout << "\\nPeople (sorted by name):" << std::endl;
    for (const auto& [name, age] : ages) {
        std::cout << "  " << name << " is " << age << " years old" << std::endl;
    }

    // Set operations
    std::set<int> set1 = {1, 2, 3, 4, 5};
    std::set<int> set2 = {3, 4, 5, 6, 7};
    std::set<int> intersection;
    std::set_intersection(set1.begin(), set1.end(),
                          set2.begin(), set2.end(),
                          std::inserter(intersection, intersection.begin()));
    std::cout << "\\nIntersection of {1,2,3,4,5} and {3,4,5,6,7}: ";
    for (auto n : intersection) std::cout << n << " ";
    std::cout << std::endl;

    // Find min/max with algorithms
    auto [min_it, max_it] = std::minmax_element(ages.begin(), ages.end(),
        [](const auto& a, const auto& b) { return a.second < b.second; });
    std::cout << "\\nYoungest: " << min_it->first << " (" << min_it->second << ")" << std::endl;
    std::cout << "Oldest: " << max_it->first << " (" << max_it->second << ")" << std::endl;

    return 0;
}
`,
  },
  {
    id: 'cpp-classes',
    name: 'C++: Classes & Templates',
    description: 'OOP with inheritance, virtual methods, templates.',
    language: 'cpp',
    code: `// Modern C++ with classes, inheritance, and templates.
// Demonstrates virtual methods, smart pointers, and std::format-like output.

#include <iostream>
#include <memory>
#include <vector>
#include <string>
#include <cmath>

// Abstract base class
class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
    virtual std::string name() const = 0;

    // Virtual method that derived classes can override
    virtual void describe() const {
        std::cout << name() << " with area " << area() << std::endl;
    }
};

// Derived class: Circle
class Circle : public Shape {
    double radius;
public:
    Circle(double r) : radius(r) {}
    double area() const override { return M_PI * radius * radius; }
    std::string name() const override { return "Circle"; }
};

// Derived class: Rectangle
class Rectangle : public Shape {
    double width, height;
public:
    Rectangle(double w, double h) : width(w), height(h) {}
    double area() const override { return width * height; }
    std::string name() const override { return "Rectangle"; }
};

// Template function — works with any Shape
template <typename T>
void printArea(const T& shape) {
    std::cout << "Area: " << shape.area() << std::endl;
}

int main() {
    // Use smart pointers for automatic memory management
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(5.0));
    shapes.push_back(std::make_unique<Rectangle>(3.0, 4.0));
    shapes.push_back(std::make_unique<Circle>(2.5));

    std::cout << "Shapes:" << std::endl;
    for (const auto& shape : shapes) {
        shape->describe();
    }

    // Find the shape with the largest area
    auto max_it = std::max_element(shapes.begin(), shapes.end(),
        [](const auto& a, const auto& b) { return a->area() < b->area(); });
    std::cout << "\\nLargest: " << (*max_it)->name()
              << " (area = " << (*max_it)->area() << ")" << std::endl;

    // Total area using a lambda
    double total = 0;
    std::for_each(shapes.begin(), shapes.end(),
        [&total](const auto& s) { total += s->area(); });
    std::cout << "Total area: " << total << std::endl;

    return 0;
}
`,
  },
  {
    id: 'cpp-lambdas',
    name: 'C++: Lambdas & Algorithms',
    description: 'Modern C++ with functional programming style.',
    language: 'cpp',
    code: `// Modern C++20 with lambdas, ranges-style algorithms,
// and functional programming patterns.

#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>
#include <string>

int main() {
    std::vector<int> nums = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    // Lambda that captures by reference
    auto print = [](const auto& v, const std::string& label) {
        std::cout << label << ": ";
        for (const auto& x : v) std::cout << x << " ";
        std::cout << std::endl;
    };

    print(nums, "Original");

    // Filter: keep even numbers
    std::vector<int> evens;
    std::copy_if(nums.begin(), nums.end(), std::back_inserter(evens),
        [](int n) { return n % 2 == 0; });
    print(evens, "Evens");

    // Transform: square each number
    std::vector<int> squares;
    std::transform(nums.begin(), nums.end(), std::back_inserter(squares),
        [](int n) { return n * n; });
    print(squares, "Squares");

    // Reduce: sum of all numbers
    int sum = std::accumulate(nums.begin(), nums.end(), 0);
    std::cout << "Sum: " << sum << std::endl;

    // Reduce with a lambda: product of all numbers
    int product = std::accumulate(nums.begin(), nums.end(), 1,
        [](int acc, int n) { return acc * n; });
    std::cout << "Product: " << product << std::endl;

    // Find min and max
    auto [min_it, max_it] = std::minmax_element(nums.begin(), nums.end());
    std::cout << "Min: " << *min_it << ", Max: " << *max_it << std::endl;

    // Count elements greater than 5
    auto count = std::count_if(nums.begin(), nums.end(),
        [](int n) { return n > 5; });
    std::cout << "Count > 5: " << count << std::endl;

    // Sort in descending order with a lambda comparator
    std::vector<int> desc = nums;
    std::sort(desc.begin(), desc.end(), [](int a, int b) { return a > b; });
    print(desc, "Descending");

    return 0;
}
`,
  },
  {
    id: 'cpp-error',
    name: 'C++: Compile Error',
    description: 'See how g++ errors appear in the console.',
    language: 'cpp',
    code: `// This file has deliberate compile errors.
// The runner will show g++ error messages
// in the console so you can see the format.

#include <iostream>
#include <vector>

int main() {
    // Using undeclared variable
    std::cout << x << std::endl;

    // Type mismatch
    int y = "hello";

    // Missing semicolon
    int z = 42

    // Template error: no matching function
    std::vector<int> v;
    v.push_back("not a number");

    return 0;
}
`,
  },
  {
    id: 'r-hello',
    name: 'R: Hello World',
    description: 'Basic R vectors and statistics.',
    language: 'r',
    code: `# Welcome to PyRunner — R 4.5 playground
# Press Run (or Ctrl/Cmd+Enter) to execute.

print("Hello, World!")

# Vectors are R's basic data structure
x <- c(1, 2, 3, 4, 5)
print(paste("Vector:", paste(x, collapse=", ")))
print(paste("Mean:", mean(x)))
print(paste("Sum:", sum(x)))
print(paste("Squared:", paste(x^2, collapse=", ")))

# Sequence
print(paste("1:10:", paste(1:10, collapse=", ")))
`,
  },
  {
    id: 'r-interactive',
    name: 'R: Interactive Input',
    description: 'Read from stdin with readLines.',
    language: 'r',
    code: `# This program reads input from the console.
# When you press Run, the prompt will appear in
# the console — type your answer and press Enter.

cat("What's your name? ")
name <- readLines(file("stdin"), n=1)

cat("How old are you? ")
age <- as.integer(readLines(file("stdin"), n=1))

cat("\\n")
cat("Hello,", name, "!\\n")
cat("In 10 years you'll be", age + 10, ".\\n")
`,
  },
  {
    id: 'r-dataframe',
    name: 'R: Data Frames',
    description: 'Create and analyze data frames.',
    language: 'r',
    code: `# Data frames are R's tabular data structure.
# Perfect for data analysis and statistics.

# Create a data frame
students <- data.frame(
  name = c("Alice", "Bob", "Charlie", "Diana", "Eve"),
  age = c(20, 22, 19, 21, 23),
  grade = c("A", "B", "A", "A", "B"),
  gpa = c(3.8, 3.2, 3.9, 3.7, 3.5)
)

print("Students data frame:")
print(students)

# Summary statistics
cat("\\nSummary statistics:\\n")
print(summary(students))

# Filter: students with GPA > 3.5
high_gpa <- students[students$gpa > 3.5, ]
cat("\\nStudents with GPA > 3.5:\\n")
print(high_gpa)

# Sort by age
sorted <- students[order(students$age), ]
cat("\\nSorted by age:\\n")
print(sorted)

# Average GPA
cat("\\nAverage GPA:", mean(students$gpa), "\\n")
cat("Average age:", mean(students$age), "\\n")
`,
  },
  {
    id: 'r-statistics',
    name: 'R: Statistics',
    description: 'Linear regression and statistical tests.',
    language: 'r',
    code: `# R is built for statistics. This example shows
# linear regression, correlation, and random sampling.

set.seed(42)  # For reproducibility

# Generate random data
x <- 1:20
y <- 2 * x + rnorm(20, mean=0, sd=3)  # y = 2x + noise

# Linear regression
model <- lm(y ~ x)
cat("Linear regression: y = 2x + noise\\n")
print(summary(model))

# Correlation
cat("\\nCorrelation between x and y:", cor(x, y), "\\n")

# Predictions
predictions <- predict(model)
cat("\\nFirst 5 predictions:", head(predictions), "\\n")

# Normal distribution samples
cat("\\nNormal distribution samples (mean=100, sd=15):\\n")
iq_scores <- rnorm(100, mean=100, sd=15)
cat("Mean:", mean(iq_scores), "\\n")
cat("SD:", sd(iq_scores), "\\n")
cat("Min:", min(iq_scores), "\\n")
cat("Max:", max(iq_scores), "\\n")

# Quantiles
cat("\\nQuantiles:\\n")
print(quantile(iq_scores, c(0.25, 0.5, 0.75)))
`,
  },
  {
    id: 'r-matrix',
    name: 'R: Matrix Operations',
    description: 'Matrix algebra and apply functions.',
    language: 'r',
    code: `# R has powerful matrix operations.
# This example shows matrix creation, multiplication,
# and the apply() function for row/column operations.

# Create matrices
A <- matrix(1:9, nrow=3, byrow=TRUE)
B <- matrix(c(1, 0, 0, 0, 1, 0, 0, 0, 1), nrow=3)

cat("Matrix A:\\n")
print(A)
cat("\\nMatrix B (identity):\\n")
print(B)

# Matrix multiplication
cat("\\nA %*% B (should equal A):\\n")
print(A %*% B)

# Element-wise operations
cat("\\nA * A (element-wise):\\n")
print(A * A)

# Transpose
cat("\\nTranspose of A:\\n")
print(t(A))

# Row and column sums
cat("\\nRow sums:", rowSums(A), "\\n")
cat("Column sums:", colSums(A), "\\n")

# apply() function
cat("\\nRow means (apply):", apply(A, 1, mean), "\\n")
cat("Column means (apply):", apply(A, 2, mean), "\\n")

# Eigenvalues
cat("\\nEigenvalues of A:\\n")
print(eigen(A)$values)
`,
  },
]
