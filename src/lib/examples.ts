export interface Snippet {
  id: string
  name: string
  description: string
  code: string
  language?: 'python' | 'java' | 'c' | 'cpp' | 'r' | 'javascript' | 'php' | 'csharp' | 'dart' | 'flutter' | 'html' | 'sql' | 'kotlin' | 'go' | 'typescript' | 'rust' | 'ruby' | 'swift' | 'lua' | 'perl' | 'powershell' | 'bash'
  files?: Record<string, string>
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
    description: 'Read from stdin with readline().',
    language: 'r',
    code: `# This program reads input using readline().
# Open the "Program Input" panel below the editor
# and type your input values (one per line) before Run.
# Example input:
#   Arun
#   20

name <- readline("Enter your name: ")
age <- as.integer(readline("Enter your age: "))

cat("Name:", name, "\\n")
cat("Age:", age, "\\n")
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
  {
    id: 'js-hello',
    name: 'JS: Hello World',
    description: 'Basic JavaScript with console.log and arrays.',
    language: 'javascript',
    code: `// Welcome to PyRunner — JavaScript (Node.js 24) playground
// Press Run (or Ctrl/Cmd+Enter) to execute.

console.log("Hello, World!");

// Array methods — functional programming style
const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

console.log("Original:", nums);
console.log("Sum:", nums.reduce((a, b) => a + b, 0));
console.log("Evens:", nums.filter(n => n % 2 === 0));
console.log("Squared:", nums.map(n => n ** 2));
console.log("Max:", Math.max(...nums));
console.log("Min:", Math.min(...nums));

// String methods
const names = ["alice", "bob", "charlie"];
console.log("\\nUppercase:", names.map(n => n.toUpperCase()));
console.log("Joined:", names.join(", "));
console.log("Sorted:", [...names].sort());

// Object destructuring
const user = { name: "Ada", age: 36, city: "London" };
const { name, age, city } = user;
console.log("\\n" + name + " is " + age + " years old, lives in " + city);
`,
  },
  {
    id: 'js-interactive',
    name: 'JS: Interactive Input',
    description: 'Read from stdin with readline.',
    language: 'javascript',
    code: `// This program reads input from the console.
// Open the "Program Input" panel below the editor
// and type your input values (one per line) before Run.
// Example input:
//   Alice
//   30

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("What's your name? ", (name) => {
  rl.question("How old are you? ", (ageStr) => {
    const age = parseInt(ageStr, 10);
    console.log("\\nHello, " + name + "!");
    console.log("In 10 years you'll be " + (age + 10) + ".");
    rl.close();
  });
});
`,
  },
  {
    id: 'js-async',
    name: 'JS: Async/Await',
    description: 'Promises, async/await, and timers.',
    language: 'javascript',
    code: `// Modern JavaScript with async/await and Promises.
// Demonstrates async programming patterns.

// Simulate an async API call
function fetchUser(id) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ id, name: "User " + id, email: "user" + id + "@example.com" });
    }, 100);
  });
}

function fetchPosts(userId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, title: "First post by " + userId },
        { id: 2, title: "Second post by " + userId },
      ]);
    }, 100);
  });
}

// Using async/await
async function main() {
  console.log("Fetching user...");
  const user = await fetchUser(42);
  console.log("Got user:", user);

  console.log("\\nFetching posts...");
  const posts = await fetchPosts(user.id);
  console.log("Got " + posts.length + " posts:");
  posts.forEach(p => console.log("  - " + p.title));

  // Promise.all — parallel execution
  console.log("\\nFetching 3 users in parallel...");
  const users = await Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)]);
  users.forEach(u => console.log("  - " + u.name + " (" + u.email + ")"));

  console.log("\\nDone!");
}

main().catch(console.error);
`,
  },
  {
    id: 'js-classes',
    name: 'JS: Classes & OOP',
    description: 'ES6 classes, inheritance, getters/setters.',
    language: 'javascript',
    code: `// Modern JavaScript with ES6 classes.
// Demonstrates inheritance, static methods, getters/setters.

class Animal {
  constructor(name, sound) {
    this._name = name;
    this._sound = sound;
  }

  get name() { return this._name; }
  set name(value) { this._name = value; }

  speak() {
    return this._name + " says " + this._sound;
  }

  static create(name, sound) {
    return new Animal(name, sound);
  }
}

class Dog extends Animal {
  constructor(name) {
    super(name, "Woof");
  }

  fetch() {
    return this._name + " fetches the ball!";
  }
}

class Cat extends Animal {
  constructor(name) {
    super(name, "Meow");
  }

  purr() {
    return this._name + " purrs softly...";
  }
}

// Create instances
const animals = [
  new Dog("Rex"),
  new Cat("Whiskers"),
  Animal.create("Cow", "Moo"),
];

console.log("Animals:");
animals.forEach(a => console.log("  " + a.speak()));

console.log("\\n" + animals[0].fetch());
console.log(animals[1].purr());

// Use setter
animals[0].name = "Buddy";
console.log("\\nRenamed: " + animals[0].speak());
`,
  },
  {
    id: 'js-functional',
    name: 'JS: Functional Programming',
    description: 'Map, filter, reduce, closures, currying.',
    language: 'javascript',
    code: `// Functional programming patterns in JavaScript.
// Demonstrates higher-order functions, closures, and currying.

// Currying — create a function that returns functions
const multiply = (a) => (b) => a * b;
const double = multiply(2);
const triple = multiply(3);

console.log("double(5):", double(5));
console.log("triple(5):", triple(5));

// Composition — combine functions
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
const addOne = (x) => x + 1;
const square = (x) => x * x;

const addOneThenSquare = compose(square, addOne);
console.log("\\n(add 1, then square)(4):", addOneThenSquare(4));

// Closure — counter factory
const createCounter = () => {
  let count = 0;
  return {
    increment: () => ++count,
    decrement: () => --count,
    value: () => count,
  };
};

const counter = createCounter();
counter.increment();
counter.increment();
counter.increment();
counter.decrement();
console.log("\\nCounter:", counter.value());

// Map/Filter/Reduce chain
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const result = numbers
  .filter(n => n % 2 === 0)    // [2, 4, 6, 8, 10]
  .map(n => n * n)              // [4, 16, 36, 64, 100]
  .reduce((sum, n) => sum + n, 0);  // 220

console.log("\\nSum of squares of even numbers 1-10:", result);

// Memoization — cache expensive results
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

const slowFactorial = memoize((n) => {
  if (n <= 1) return 1;
  return n * slowFactorial(n - 1);
});

console.log("\\n5!:", slowFactorial(5));
console.log("10!:", slowFactorial(10));
`,
  },
  {
    id: 'js-json',
    name: 'JS: JSON & Objects',
    description: 'Parse, stringify, and manipulate JSON.',
    language: 'javascript',
    code: `// JSON manipulation in JavaScript.
// Demonstrates parse, stringify, and object operations.

// Create a JavaScript object
const user = {
  id: 42,
  name: "Ada Lovelace",
  email: "ada@example.com",
  roles: ["admin", "user"],
  address: {
    street: "100 Math Street",
    city: "London",
    country: "UK",
  },
  active: true,
};

// Serialize to JSON string (pretty-printed)
const json = JSON.stringify(user, null, 2);
console.log("JSON string:");
console.log(json);

// Parse JSON back to object
const parsed = JSON.parse(json);
console.log("\\nParsed back:");
console.log("Name:", parsed.name);
console.log("City:", parsed.address.city);
console.log("Roles:", parsed.roles.join(", "));

// Object destructuring and spread
const { name, email, address: { city } } = user;
console.log("\\nDestructured:");
console.log("  name:", name);
console.log("  email:", email);
console.log("  city:", city);

// Object spread — merge objects
const updates = { email: "ada.lovelace@example.com", active: false };
const updatedUser = { ...user, ...updates };
console.log("\\nUpdated user:");
console.log("  email:", updatedUser.email);
console.log("  active:", updatedUser.active);

// Object.keys / Object.values / Object.entries
console.log("\\nObject entries:");
Object.entries(user).forEach(([key, value]) => {
  if (typeof value !== 'object') {
    console.log("  " + key + ":", value);
  }
});

// Map to JSON array
const products = [
  { name: "Laptop", price: 999 },
  { name: "Phone", price: 599 },
  { name: "Tablet", price: 399 },
];

const productsJson = JSON.stringify(products, null, 2);
console.log("\\nProducts JSON:");
console.log(productsJson);

const total = JSON.parse(productsJson)
  .reduce((sum, p) => sum + p.price, 0);
console.log("\\nTotal price: $" + total);
`,
  },
  {
    id: 'js-browser-apis',
    name: 'JS: Browser APIs',
    description: 'prompt(), alert(), confirm() polyfilled.',
    language: 'javascript',
    code: `// Browser APIs work in PyRunner!
// prompt() reads from stdin (Program Input panel)
// alert() prints to stdout
// confirm() reads y/n from stdin

// Open "Program Input" and type values, one per line:
//   Alice
//   25
//   y

let name = prompt("Enter your name: ");
let ageStr = prompt("Enter your age: ");
let age = parseInt(ageStr, 10);

alert("Hello, " + name + "!");
alert("In 10 years you'll be " + (age + 10) + ".");

let likesPython = confirm("Do you like programming? ");
if (likesPython) {
  alert("Awesome! Keep coding!");
} else {
  alert("Give it another try!");
}
`,
  },
  {
    id: 'php-hello',
    name: 'PHP: Hello World',
    description: 'Basic PHP with echo and arrays.',
    language: 'php',
    code: `<?php
// Welcome to PyRunner — PHP 8.4 playground
// Press Run (or Ctrl/Cmd+Enter) to execute.

echo "Hello, World!\\n";

// Array functions
$nums = [1, 2, 3, 4, 5];
echo "Sum: " . array_sum($nums) . "\\n";
echo "Max: " . max($nums) . "\\n";
echo "Squared: " . implode(", ", array_map(fn($n) => $n * $n, $nums)) . "\\n";

// Associative array
$user = ["name" => "Ada", "age" => 36, "city" => "London"];
echo "\\n" . $user["name"] . " is " . $user["age"] . " years old.\\n";

// String functions
$str = "Hello, PHP!";
echo "Uppercase: " . strtoupper($str) . "\\n";
echo "Length: " . strlen($str) . "\\n";
echo "Reversed: " . strrev($str) . "\\n";
`,
  },
  {
    id: 'php-interactive',
    name: 'PHP: Interactive Input',
    description: 'Read from stdin with fgets.',
    language: 'php',
    code: `<?php
// This program reads input from stdin.
// Open "Program Input" below the editor and type
// your values (one per line) before Run.
// Example: Alice / 25

echo "What's your name? ";
$name = trim(fgets(STDIN));

echo "How old are you? ";
$age = (int)trim(fgets(STDIN));

echo "\\nHello, $name!\\n";
echo "In 10 years you'll be " . ($age + 10) . ".\\n";
`,
  },
  {
    id: 'php-classes',
    name: 'PHP: Classes & OOP',
    description: 'Modern PHP with classes, traits, interfaces.',
    language: 'php',
    code: `<?php
// Modern PHP 8.4 OOP with classes, interfaces, and traits.

interface Greetable {
    public function greet(): string;
}

trait Nameable {
    public function getName(): string {
        return $this->name;
    }
}

class Person implements Greetable {
    use Nameable;

    public function __construct(
        public string $name,
        public int $age
    ) {}

    public function greet(): string {
        return "Hi, I'm {$this->name}!";
    }

    public function __toString(): string {
        return "{$this->name} (age {$this->age})";
    }
}

class Student extends Person {
    public function __construct(
        string $name,
        int $age,
        public string $major
    ) {
        parent::__construct($name, $age);
    }

    public function study(): string {
        return "{$this->name} is studying {$this->major}.";
    }
}

// Create instances
$people = [
    new Person("Alice", 30),
    new Student("Bob", 22, "Computer Science"),
    new Student("Charlie", 19, "Mathematics"),
];

foreach ($people as $person) {
    echo $person->greet() . "\\n";
    echo "  " . $person . "\\n";

    if ($person instanceof Student) {
        echo "  " . $person->study() . "\\n";
    }
    echo "\\n";
}
`,
  },
  {
    id: 'php-json',
    name: 'PHP: JSON & Arrays',
    description: 'Encode/decode JSON and manipulate arrays.',
    language: 'php',
    code: `<?php
// JSON manipulation in PHP.

// Create an associative array
$data = [
    "name" => "Ada Lovelace",
    "email" => "ada@example.com",
    "age" => 36,
    "roles" => ["admin", "user"],
    "address" => [
        "street" => "100 Math Street",
        "city" => "London",
    ],
];

// Encode to JSON
$json = json_encode($data, JSON_PRETTY_PRINT);
echo "JSON string:\\n$json\\n\\n";

// Decode back to object
$obj = json_decode($json);
echo "Name: " . $obj->name . "\\n";
echo "City: " . $obj->address->city . "\\n";
echo "Roles: " . implode(", ", $obj->roles) . "\\n\\n";

// Array operations
$products = [
    ["name" => "Laptop", "price" => 999],
    ["name" => "Phone", "price" => 599],
    ["name" => "Tablet", "price" => 399],
];

// Sort by price
usort($products, fn($a, $b) => $a["price"] <=> $b["price"]);

echo "Products sorted by price:\\n";
foreach ($products as $p) {
    echo "  " . $p["name"] . ": $" . $p["price"] . "\\n";
}

// Total price
$total = array_sum(array_column($products, "price"));
echo "\\nTotal: $" . $total . "\\n";
`,
  },
  {
    id: 'php-fizzbuzz',
    name: 'PHP: FizzBuzz',
    description: 'Classic FizzBuzz with match expression.',
    language: 'php',
    code: `<?php
// Classic FizzBuzz using PHP 8 match expression.

for ($i = 1; $i <= 30; $i++) {
    echo match(true) {
        $i % 15 === 0 => "FizzBuzz",
        $i % 3 === 0  => "Fizz",
        $i % 5 === 0  => "Buzz",
        default        => (string)$i,
    } . "\\n";
}
`,
  },
  {
    id: 'cs-hello',
    name: 'C#: Hello World',
    description: 'Basic C# with Console.WriteLine and LINQ.',
    language: 'csharp',
    code: `// PyRunner — C# (.NET 8) playground
// Press Run (or Ctrl/Cmd+Enter) to execute.

using System;
using System.Linq;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");

        // LINQ
        int[] nums = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
        Console.WriteLine("Sum: " + nums.Sum());
        Console.WriteLine("Evens: " + string.Join(", ", nums.Where(n => n % 2 == 0)));
        Console.WriteLine("Squared: " + string.Join(", ", nums.Select(n => n * n)));
    }
}
`,
  },
  {
    id: 'cs-interactive',
    name: 'C#: Interactive Input',
    description: 'Read from stdin with Console.ReadLine.',
    language: 'csharp',
    code: `using System;

class Program {
    static void Main() {
        // Open "Program Input" below the editor and type:
        //   Alice
        //   25
        Console.Write("What's your name? ");
        string name = Console.ReadLine();

        Console.Write("How old are you? ");
        int age = int.Parse(Console.ReadLine());

        Console.WriteLine();
        Console.WriteLine("Hello, " + name + "!");
        Console.WriteLine("In 10 years you'll be " + (age + 10) + ".");
    }
}
`,
  },
  {
    id: 'cs-classes',
    name: 'C#: Classes & OOP',
    description: 'Classes, inheritance, interfaces, generics.',
    language: 'csharp',
    code: `using System;
using System.Collections.Generic;

interface IAnimal {
    string Name { get; }
    string Speak();
}

abstract class Animal : IAnimal {
    public string Name { get; }
    protected string Sound { get; }

    protected Animal(string name, string sound) {
        Name = name;
        Sound = sound;
    }

    public string Speak() => Name + " says " + Sound;
}

class Dog : Animal {
    public Dog(string name) : base(name, "Woof") {}
    public string Fetch() => Name + " fetches the ball!";
}

class Cat : Animal {
    public Cat(string name) : base(name, "Meow") {}
    public string Purr() => Name + " purrs softly...";
}

class Program {
    static void Main() {
        List<IAnimal> animals = new List<IAnimal> {
            new Dog("Rex"),
            new Cat("Whiskers"),
            new Dog("Buddy"),
        };

        foreach (var animal in animals) {
            Console.WriteLine(animal.Speak());
            if (animal is Dog dog) Console.WriteLine("  " + dog.Fetch());
            if (animal is Cat cat) Console.WriteLine("  " + cat.Purr());
        }
    }
}
`,
  },
  {
    id: 'cs-linq',
    name: 'C#: LINQ',
    description: 'Query collections with LINQ.',
    language: 'csharp',
    code: `using System;
using System.Linq;
using System.Collections.Generic;

class Program {
    static void Main() {
        var people = new List<Person> {
            new Person("Alice", 30, "Engineering"),
            new Person("Bob", 25, "Marketing"),
            new Person("Charlie", 35, "Engineering"),
            new Person("Diana", 28, "Sales"),
            new Person("Eve", 32, "Engineering"),
        };

        // Filter + sort
        var engineers = people
            .Where(p => p.Department == "Engineering")
            .OrderBy(p => p.Age);

        Console.WriteLine("Engineers (sorted by age):");
        foreach (var p in engineers) {
            Console.WriteLine("  " + p);
        }

        // Group by department
        var byDept = people.GroupBy(p => p.Department);
        foreach (var group in byDept) {
            Console.WriteLine("\\n" + group.Key + ": " + group.Count() + " people");
            foreach (var p in group) {
                Console.WriteLine("  " + p.Name + " (" + p.Age + ")");
            }
        }

        // Aggregate
        var avgAge = people.Average(p => p.Age);
        Console.WriteLine("\\nAverage age: " + avgAge.ToString("F1"));

        // Select + ToDictionary
        var names = people.Select(p => p.Name).ToList();
        Console.WriteLine("Names: " + string.Join(", ", names));
    }
}

class Person {
    public string Name { get; set; }
    public int Age { get; set; }
    public string Department { get; set; }

    public Person(string name, int age, string dept) {
        Name = name; Age = age; Department = dept;
    }

    public override string ToString() => Name + " (" + Age + ", " + Department + ")";
}
`,
  },
  {
    id: 'cs-fizzbuzz',
    name: 'C#: FizzBuzz',
    description: 'Classic FizzBuzz with switch expression.',
    language: 'csharp',
    code: `using System;

class Program {
    static void Main() {
        for (int i = 1; i <= 30; i++) {
            Console.WriteLine(
                (i % 15 == 0, i % 3 == 0, i % 5 == 0) switch {
                    (true, _, _) => "FizzBuzz",
                    (_, true, _) => "Fizz",
                    (_, _, true) => "Buzz",
                    _ => i.ToString(),
                }
            );
        }
    }
}
`,
  },
  {
    id: 'dart-hello',
    name: 'Dart: Hello World',
    description: 'Basic Dart with print and lists.',
    language: 'dart',
    code: `// PyRunner - Dart 3.13 playground
// Press Run (or Ctrl/Cmd+Enter) to execute.

void main() {
  print('Hello, World!');

  // List methods
  var nums = [1, 2, 3, 4, 5];
  print('Sum: ' + nums.reduce((a, b) => a + b).toString() + '');
  print('Squared: ' + nums.map((n) => n * n).join(', ') + '');

  // String interpolation
  var name = 'Ada';
  var age = 36;
  print('\' + name + ' is \' + age.toString() + ' years old.');
}
`,
  },
  {
    id: 'dart-interactive',
    name: 'Dart: Interactive Input',
    description: 'Read from stdin with readLineSync.',
    language: 'dart',
    code: `import 'dart:io';

void main() {
  // Open "Program Input" and type values (one per line):
  //   Alice
  //   25
  stdout.write("What's your name? ");
  var name = stdin.readLineSync();

  stdout.write("How old are you? ");
  var age = int.parse(stdin.readLineSync()!);

  print('');
  print('Hello, \' + name + '!');
  print("In 10 years you'll be ' + (age + 10).toString() + '.");
}
`,
  },
  {
    id: 'dart-classes',
    name: 'Dart: Classes & Mixins',
    description: 'Classes, mixins, abstract classes.',
    language: 'dart',
    code: `// Modern Dart with classes, mixins, and abstract classes.

mixin Greetable {
  String get name;
  String greet() => 'Hi, I am \' + name + '!';
}

abstract class Animal {
  final String name;
  final String sound;

  Animal(this.name, this.sound);

  String speak() => '\' + name + ' says \\$sound';
}

class Dog extends Animal with Greetable {
  Dog(String name) : super(name, 'Woof');
  String fetch() => '\' + name + ' fetches the ball!';
}

class Cat extends Animal with Greetable {
  Cat(String name) : super(name, 'Meow');
  String purr() => '\' + name + ' purrs softly...';
}

void main() {
  var animals = <Animal>[
    Dog('Rex'),
    Cat('Whiskers'),
    Dog('Buddy'),
  ];

  for (var animal in animals) {
    print(animal.speak());
    if (animal is Dog) print('  ' + animal.fetch() + '');
    if (animal is Cat) print('  ' + animal.purr() + '');
    if (animal is Greetable) print('  ' + animal.greet() + '');
  }
}
`,
  },
  {
    id: 'dart-async',
    name: 'Dart: Async/Await',
    description: 'Futures, async/await, streams.',
    language: 'dart',
    code: `import 'dart:async';

Future<String> fetchUser(int id) async {
  await Future.delayed(Duration(milliseconds: 100));
  return 'User \\$id';
}

Future<List<String>> fetchPosts(int userId) async {
  await Future.delayed(Duration(milliseconds: 100));
  return ['Post 1 by \' + user + 'Id', 'Post 2 by \' + user + 'Id'];
}

void main() async {
  print('Fetching user...');
  var user = await fetchUser(42);
  print('Got: \' + user + '');

  print('\\nFetching posts...');
  var posts = await fetchPosts(42);
  for (var post in posts) {
    print('  - \' + post + '');
  }

  // Parallel execution with Future.wait
  print('\\nFetching 3 users in parallel...');
  var users = await Future.wait([
    fetchUser(1),
    fetchUser(2),
    fetchUser(3),
  ]);
  for (var u in users) {
    print('  - \' + u + '');
  }

  print('\\nDone!');
}
`,
  },
  {
    id: 'dart-fizzbuzz',
    name: 'Dart: FizzBuzz',
    description: 'Classic FizzBuzz with collections.',
    language: 'dart',
    code: `void main() {
  for (var i = 1; i <= 30; i++) {
    if (i % 15 == 0) {
      print('FizzBuzz');
    } else if (i % 3 == 0) {
      print('Fizz');
    } else if (i % 5 == 0) {
      print('Buzz');
    } else {
      print(i);
    }
  }
}
`,
  },
  {
    id: 'flutter-hello',
    name: 'Flutter: Hello Widget',
    description: 'Simple Flutter app with MaterialApp.',
    language: 'flutter',
    code: `// Flutter widget test - runs headlessly
// Write your widget code and press Run.
// The code runs inside testWidgets().

await tester.pumpWidget(
  MaterialApp(
    home: Scaffold(
      appBar: AppBar(title: Text('My Flutter App')),
      body: Center(
        child: Text(
          'Hello from Flutter!',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
        ),
      ),
    ),
  ),
);

expect(find.text('Hello from Flutter!'), findsOneWidget);
print('Widget rendered successfully!');
print('AppBar: My Flutter App');
print('Body: Hello from Flutter!');
`,
  },
  {
    id: 'flutter-counter',
    name: 'Flutter: Counter App',
    description: 'Stateful widget with button tap.',
    language: 'flutter',
    code: `// A simple counter app as a widget test

int counter = 0;

await tester.pumpWidget(
  MaterialApp(
    home: Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Counter: 0'),
            ElevatedButton(
              key: Key('increment'),
              onPressed: () {},
              child: Icon(Icons.add),
            ),
          ],
        ),
      ),
    ),
  ),
);

expect(find.text('Counter: 0'), findsOneWidget);
expect(find.byIcon(Icons.add), findsOneWidget);
print('Counter app rendered!');
print('  Initial value: 0');

// Simulate button tap
await tester.tap(find.byKey(Key('increment')));
await tester.pump();
print('  Button tapped!');
`,
  },
  {
    id: 'flutter-list',
    name: 'Flutter: ListView',
    description: 'A list of items with ListTile.',
    language: 'flutter',
    code: `// Build a ListView with multiple items

final items = List.generate(5, (i) => 'Item ' + (i + 1).toString());

await tester.pumpWidget(
  MaterialApp(
    home: Scaffold(
      appBar: AppBar(title: Text('My List')),
      body: ListView.builder(
        itemCount: items.length,
        itemBuilder: (context, index) {
          return ListTile(
            leading: CircleAvatar(child: Text((index + 1).toString())),
            title: Text(items[index]),
            subtitle: Text('Subtitle for item ' + (index + 1).toString()),
            trailing: Icon(Icons.arrow_forward),
          );
        },
      ),
    ),
  ),
);

expect(find.text('Item 1'), findsOneWidget);
expect(find.text('Item 5'), findsOneWidget);
print('ListView rendered with 5 items!');
for (var item in items) {
  print('  - ' + item);
}
`,
  },
  {
    id: 'flutter-form',
    name: 'Flutter: Form Widgets',
    description: 'TextField, Checkbox, Switch, Slider.',
    language: 'flutter',
    code: `// Form widgets demo

await tester.pumpWidget(
  MaterialApp(
    home: Scaffold(
      appBar: AppBar(title: Text('Form Demo')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              decoration: InputDecoration(
                labelText: 'Enter your name',
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 16),
            Row(
              children: [
                Checkbox(value: true, onChanged: null),
                Text('I agree to terms'),
              ],
            ),
            SizedBox(height: 16),
            Row(
              children: [
                Switch(value: false, onChanged: null),
                Text('Enable notifications'),
              ],
            ),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: null,
              child: Text('Submit'),
            ),
          ],
        ),
      ),
    ),
  ),
);

expect(find.text('Enter your name'), findsOneWidget);
expect(find.text('Submit'), findsOneWidget);
print('Form rendered successfully!');
print('  - TextField: Enter your name');
print('  - Checkbox: checked');
print('  - Switch: off');
print('  - Button: Submit');
`,
  },
  {
    id: 'flutter-full-app',
    name: 'Flutter: Full App (Preview)',
    description: 'Complete Flutter app with interactivity — opens in preview panel.',
    language: 'flutter',
    code: `import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PyRunner Demo',
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF6366F1),
        useMaterial3: true,
      ),
      home: const CounterPage(),
    );
  }
}

class CounterPage extends StatefulWidget {
  const CounterPage({super.key});

  @override
  State<CounterPage> createState() => _CounterPageState();
}

class _CounterPageState extends State<CounterPage> {
  int _counter = 0;

  void _increment() => setState(() => _counter++);
  void _decrement() => setState(() => _counter--);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Flutter Live Preview'),
        centerTitle: true,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.flutter_dash, size: 72, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text('Counter value', style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              '\$_counter',
              style: TextStyle(
                fontSize: 48,
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FilledButton.tonalIcon(
                  onPressed: _decrement,
                  icon: const Icon(Icons.remove),
                  label: const Text('Decrement'),
                ),
                const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: _increment,
                  icon: const Icon(Icons.add),
                  label: const Text('Increment'),
                ),
              ],
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _increment,
        child: const Icon(Icons.add),
      ),
    );
  }
}
`,
  },
  {
    id: 'html-hello',
    name: 'HTML: Hello World',
    description: 'A simple HTML page with inline CSS.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hello, HTML!</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      padding: 48px 64px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
    h1 { margin: 0 0 8px; font-size: 36px; }
    p { margin: 0; opacity: 0.85; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello, HTML!</h1>
    <p>Edit this code and press Run to see the live preview.</p>
  </div>
</body>
</html>
`,
  },
  {
    id: 'html-flex-layout',
    name: 'HTML: Flexbox Layout',
    description: 'Responsive flexbox with cards and hover effects.',
    language: 'html',
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      background: #f4f5f7;
      padding: 24px;
    }
    h1 {
      color: #1f2937;
      margin-bottom: 24px;
      font-size: 28px;
    }
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .card {
      flex: 1 1 250px;
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    }
    .card .icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 16px;
      color: white;
    }
    .card.blue .icon { background: #3b82f6; }
    .card.green .icon { background: #10b981; }
    .card.purple .icon { background: #8b5cf6; }
    .card.orange .icon { background: #f59e0b; }
    .card h3 { margin-bottom: 8px; color: #1f2937; }
    .card p { color: #6b7280; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Flexbox Cards</h1>
  <div class="grid">
    <div class="card blue">
      <div class="icon">A</div>
      <h3>Alpha</h3>
      <p>Hover over this card to see the lift effect.</p>
    </div>
    <div class="card green">
      <div class="icon">B</div>
      <h3>Beta</h3>
      <p>Cards auto-wrap on smaller screens.</p>
    </div>
    <div class="card purple">
      <div class="icon">C</div>
      <h3>Gamma</h3>
      <p>Flexbox makes responsive layouts easy.</p>
    </div>
    <div class="card orange">
      <div class="icon">D</div>
      <h3>Delta</h3>
      <p>Try resizing the browser window.</p>
    </div>
  </div>
</body>
</html>
`,
  },
  {
    id: 'html-counter',
    name: 'HTML: Interactive Counter',
    description: 'Counter app with HTML + CSS + JavaScript.',
    language: 'html',
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: white;
      min-height: 100vh;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .counter {
      text-align: center;
    }
    .value {
      font-size: 96px;
      font-weight: bold;
      margin: 24px 0;
      color: #10b981;
      font-variant-numeric: tabular-nums;
    }
    button {
      background: #10b981;
      color: white;
      border: none;
      padding: 12px 24px;
      margin: 0 8px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #059669; }
    button.reset { background: #6b7280; }
    button.reset:hover { background: #4b5563; }
  </style>
</head>
<body>
  <div class="counter">
    <h2>Interactive Counter</h2>
    <div class="value" id="count">0</div>
    <button onclick="decrease()">- Decrease</button>
    <button class="reset" onclick="reset()">Reset</button>
    <button onclick="increase()">+ Increase</button>
  </div>
  <script>
    let count = 0;
    const el = document.getElementById('count');
    function update() { el.textContent = count; }
    function increase() { count++; update(); }
    function decrease() { count--; update(); }
    function reset() { count = 0; update(); }
  </script>
</body>
</html>
`,
  },
  {
    id: 'html-form',
    name: 'HTML: Styled Form',
    description: 'A login form with animated gradient background.',
    language: 'html',
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      background: linear-gradient(135deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
      background-size: 400% 400%;
      animation: gradient 15s ease infinite;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    @keyframes gradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .form-card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #1f2937;
      margin-bottom: 8px;
      font-size: 28px;
    }
    .subtitle {
      color: #6b7280;
      margin-bottom: 24px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      color: #374151;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 15px;
      transition: border-color 0.2s;
      outline: none;
    }
    input:focus { border-color: #3b82f6; }
    button {
      width: 100%;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 14px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.2s;
    }
    button:hover { background: #2563eb; }
    .footer {
      text-align: center;
      margin-top: 16px;
      color: #6b7280;
      font-size: 13px;
    }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="form-card">
    <h1>Welcome back</h1>
    <p class="subtitle">Please sign in to your account</p>
    <form onsubmit="event.preventDefault(); alert('Demo: form submitted!')">
      <div class="form-group">
        <label>Email</label>
        <input type="email" placeholder="you@example.com" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" placeholder="Password" required>
      </div>
      <button type="submit">Sign in</button>
    </form>
    <p class="footer">Don't have an account? <a href="#">Sign up</a></p>
  </div>
</body>
</html>
`,
  },
  {
    id: 'sql-crud',
    name: 'SQL: CRUD Basics',
    description: 'CREATE TABLE, INSERT, SELECT, UPDATE, DELETE.',
    language: 'sql',
    code: `-- SQL basics: CREATE, INSERT, SELECT, UPDATE, DELETE
-- Press Run to execute all statements and see results.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  age INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email, age) VALUES
  ('Alice', 'alice@example.com', 28),
  ('Bob', 'bob@example.com', 34),
  ('Charlie', 'charlie@example.com', 22),
  ('Diana', 'diana@example.com', 41);

-- Select all users
SELECT id, name, email, age FROM users;

-- Select with WHERE clause
SELECT name, age FROM users WHERE age >= 30 ORDER BY age DESC;

-- Update a record
UPDATE users SET age = 29 WHERE name = 'Alice';

-- Delete a record
DELETE FROM users WHERE name = 'Charlie';

-- Final state
SELECT name, age FROM users ORDER BY name;
`,
  },
  {
    id: 'sql-joins',
    name: 'SQL: Joins & Aggregates',
    description: 'INNER JOIN, LEFT JOIN, GROUP BY, HAVING.',
    language: 'sql',
    code: `-- SQL Joins, GROUP BY, and aggregate functions
-- Demonstrates a classic orders/customers/products schema.

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  country TEXT
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  price REAL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  product_id INTEGER,
  quantity INTEGER,
  order_date TEXT
);

INSERT INTO customers VALUES
  (1, 'Alice', 'USA'),
  (2, 'Bob', 'UK'),
  (3, 'Charlie', 'USA'),
  (4, 'Diana', 'Canada');

INSERT INTO products VALUES
  (1, 'Laptop', 1200.00),
  (2, 'Phone', 800.00),
  (3, 'Headphones', 150.00),
  (4, 'Monitor', 350.00);

INSERT INTO orders VALUES
  (1, 1, 1, 1, '2024-01-15'),
  (2, 1, 3, 2, '2024-01-20'),
  (3, 2, 2, 1, '2024-02-01'),
  (4, 3, 4, 3, '2024-02-10'),
  (5, 3, 2, 1, '2024-02-15'),
  (6, 4, 3, 5, '2024-03-01');

-- INNER JOIN: orders with customer + product names
SELECT
  o.order_date,
  c.name AS customer,
  p.name AS product,
  o.quantity,
  ROUND(p.price * o.quantity, 2) AS total
FROM orders o
  INNER JOIN customers c ON o.customer_id = c.id
  INNER JOIN products p ON o.product_id = p.id
ORDER BY o.order_date;

-- GROUP BY: total spent per customer
SELECT
  c.name,
  COUNT(o.id) AS orders,
  ROUND(SUM(p.price * o.quantity), 2) AS total_spent
FROM customers c
  LEFT JOIN orders o ON c.id = o.customer_id
  LEFT JOIN products p ON o.product_id = p.id
GROUP BY c.id
ORDER BY total_spent DESC;

-- HAVING: customers with more than 1 order
SELECT
  c.name,
  COUNT(o.id) AS order_count
FROM customers c
  INNER JOIN orders o ON c.id = o.customer_id
GROUP BY c.id
HAVING COUNT(o.id) > 1;
`,
  },
  {
    id: 'sql-aggregates',
    name: 'SQL: Aggregates & Subqueries',
    description: 'COUNT, AVG, MAX, MIN, subqueries, CASE.',
    language: 'sql',
    code: `-- Aggregate functions, subqueries, and CASE expressions

CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  salary REAL,
  hire_date TEXT
);

INSERT INTO employees VALUES
  (1, 'Alice', 'Engineering', 95000, '2020-03-15'),
  (2, 'Bob', 'Engineering', 88000, '2019-07-01'),
  (3, 'Charlie', 'Sales', 65000, '2021-01-20'),
  (4, 'Diana', 'Sales', 72000, '2018-11-05'),
  (5, 'Eve', 'Engineering', 105000, '2017-04-10'),
  (6, 'Frank', 'Marketing', 60000, '2022-06-01'),
  (7, 'Grace', 'Marketing', 68000, '2020-09-15');

-- COUNT, AVG, MAX, MIN per department
SELECT
  department,
  COUNT(*) AS headcount,
  ROUND(AVG(salary), 0) AS avg_salary,
  MAX(salary) AS max_salary,
  MIN(salary) AS min_salary
FROM employees
GROUP BY department
ORDER BY avg_salary DESC;

-- Subquery: employees earning more than company average
SELECT name, department, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC;

-- CASE expression: classify salary bands
SELECT
  name,
  department,
  salary,
  CASE
    WHEN salary >= 100000 THEN 'Senior'
    WHEN salary >= 80000 THEN 'Mid'
    WHEN salary >= 65000 THEN 'Junior'
    ELSE 'Entry'
  END AS level
FROM employees
ORDER BY salary DESC;

-- Top earner per department (using window-like subquery)
SELECT
  e.department,
  e.name,
  e.salary
FROM employees e
WHERE e.salary = (
  SELECT MAX(salary) FROM employees
  WHERE department = e.department
)
ORDER BY e.salary DESC;
`,
  },
  {
    id: 'sql-advanced',
    name: 'SQL: Advanced Features',
    description: 'Indexes, views, CTEs, and PRAGMA.',
    language: 'sql',
    code: `-- Advanced SQL: indexes, views, CTEs, PRAGMA

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  price REAL,
  stock INTEGER
);

INSERT INTO products VALUES
  (1, 'Laptop', 'Electronics', 1200, 15),
  (2, 'Phone', 'Electronics', 800, 30),
  (3, 'Desk', 'Furniture', 350, 5),
  (4, 'Chair', 'Furniture', 180, 12),
  (5, 'Headphones', 'Electronics', 150, 50),
  (6, 'Lamp', 'Furniture', 45, 25);

-- Create an index (for demonstration)
CREATE INDEX idx_products_category ON products(category);

-- Show table schema
SELECT sql FROM sqlite_master WHERE type='table' AND name='products';

-- Show indexes
SELECT name, tbl_name FROM sqlite_master WHERE type='index';

-- Create a view
CREATE VIEW expensive_products AS
  SELECT name, category, price
  FROM products
  WHERE price > 200
  ORDER BY price DESC;

-- Query the view
SELECT * FROM expensive_products;

-- Common Table Expression (CTE) with window functions via subquery
WITH category_stats AS (
  SELECT
    category,
    COUNT(*) AS count,
    ROUND(AVG(price), 2) AS avg_price,
    SUM(stock) AS total_stock
  FROM products
  GROUP BY category
)
SELECT
  category,
  count,
  avg_price,
  total_stock,
  ROUND(avg_price * total_stock, 2) AS potential_revenue
FROM category_stats
ORDER BY potential_revenue DESC;

-- PRAGMA: SQLite-specific metadata
PRAGMA table_info(products);

-- Pagination using LIMIT/OFFSET
SELECT id, name, price FROM products ORDER BY price DESC LIMIT 3 OFFSET 0;
SELECT id, name, price FROM products ORDER BY price DESC LIMIT 3 OFFSET 3;
`,
  },
  {
    id: 'kotlin-hello',
    name: 'Kotlin: Hello World',
    description: 'Basic Kotlin/JVM program with main function.',
    language: 'kotlin',
    code: `// Kotlin/JVM console — runs with kotlinc 2.0.21
fun main() {
    println("Hello from Kotlin!")

    val name = "World"
    println("Hello, " + name + "!")

    val result = add(3, 4)
    println("3 + 4 = " + result)
}

fun add(a: Int, b: Int): Int = a + b
`,
  },
  {
    id: 'kotlin-classes',
    name: 'Kotlin: Classes & Data Classes',
    description: 'OOP with classes, data classes, inheritance.',
    language: 'kotlin',
    code: `fun main() {
    val person = Person("Alice", 30)
    println(person)

    val student = Student("Bob", 20, "Computer Science")
    println(student)
    val isAdult = student.isAdult()
    println("Is adult: " + isAdult)

    println("Counter: " + Counter.next())
    println("Counter: " + Counter.next())
    println("Counter: " + Counter.next())
}

open class Person(val name: String, val age: Int) {
    override fun toString(): String = "Person(name=" + name + ", age=" + age + ")"
}

class Student(name: String, age: Int, val major: String) : Person(name, age) {
    fun isAdult(): Boolean = age >= 18
}

object Counter {
    private var count = 0
    fun next(): Int {
        count++
        return count
    }
}
`,
  },
  {
    id: 'kotlin-collections',
    name: 'Kotlin: Collections & Null Safety',
    description: 'Lists, maps, null safety, elvis operator.',
    language: 'kotlin',
    code: `fun main() {
    val fruits = listOf("apple", "banana", "cherry", "date")
    println("Fruits: " + fruits)
    val filtered = fruits.filter { it.length > 5 }
    println("Filtered (length > 5): " + filtered)
    val upper = fruits.map { it.uppercase() }
    println("Uppercase: " + upper)

    val prices = mapOf("apple" to 1.5, "banana" to 0.5, "cherry" to 3.0)
    val total = prices.values.sum()
    println("Total price: $" + total)

    val name: String? = null
    val nameLen = name?.length ?: 0
    println("Name length: " + nameLen)

    val nullableList: List<String?> = listOf("a", null, "b", null, "c")
    val nonNull = nullableList.filterNotNull()
    println("Non-null: " + nonNull)
}
`,
  },
  {
    id: 'go-hello',
    name: 'Go: Hello World',
    description: 'Basic Go program with main function.',
    language: 'go',
    code: `package main

import "fmt"

func main() {
    fmt.Println("Hello from Go!")
    name := "World"
    fmt.Println("Hello, " + name + "!")
}
`,
  },
  {
    id: 'go-functions',
    name: 'Go: Functions & Structs',
    description: 'Functions, structs, methods, slices.',
    language: 'go',
    code: `package main

import "fmt"

type Person struct {
    Name string
    Age  int
}

func (p Person) Greet() string {
    return "Hello, I'm " + p.Name
}

func add(a, b int) int {
    return a + b
}

func main() {
    fmt.Println("3 + 4 =", add(3, 4))

    person := Person{Name: "Alice", Age: 30}
    fmt.Println(person.Greet())
    fmt.Printf("%s is %d years old\n", person.Name, person.Age)

    fruits := []string{"apple", "banana", "cherry"}
    for i, fruit := range fruits {
        fmt.Printf("%d: %s\n", i, fruit)
    }

    nums := map[string]int{"one": 1, "two": 2, "three": 3}
    for k, v := range nums {
        fmt.Printf("%s = %d\n", k, v)
    }
}
`,
  },
  {
    id: 'go-goroutines',
    name: 'Go: Goroutines & Channels',
    description: 'Concurrent programming with goroutines.',
    language: 'go',
    code: `package main

import (
    "fmt"
    "sync"
)

func worker(id int, wg *sync.WaitGroup) {
    defer wg.Done()
    fmt.Printf("Worker %d starting\n", id)
    fmt.Printf("Worker %d done\n", id)
}

func main() {
    var wg sync.WaitGroup

    for i := 1; i <= 3; i++ {
        wg.Add(1)
        go worker(i, &wg)
    }

    wg.Wait()
    fmt.Println("All workers finished!")

    // Channel example
    ch := make(chan int, 3)
    ch <- 1
    ch <- 2
    ch <- 3
    close(ch)

    for val := range ch {
        fmt.Println("Received:", val)
    }
}
`,
  },
  {
    id: 'ts-hello',
    name: 'TypeScript: Hello World',
    description: 'Basic TypeScript with interfaces and types.',
    language: 'typescript',
    code: `// TypeScript 5.x — runs with bun
interface Person {
    name: string;
    age: number;
}

function greet(person: Person): string {
    return "Hello, " + person.name + "!";
}

const alice: Person = { name: "Alice", age: 30 };
console.log(greet(alice));

// Type-safe array operations
const numbers: number[] = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Doubled:", doubled);
`,
  },
  {
    id: 'ts-generics',
    name: 'TypeScript: Generics & Unions',
    description: 'Generic functions, union types, enums.',
    language: 'typescript',
    code: `// TypeScript generics and union types

enum Color {
    Red = "RED",
    Green = "GREEN",
    Blue = "BLUE"
}

type Result<T> = {
    success: boolean;
    data?: T;
    error?: string;
};

function wrap<T>(value: T): Result<T> {
    return { success: true, data: value };
}

function divide(a: number, b: number): Result<number> {
    if (b === 0) {
        return { success: false, error: "Division by zero" };
    }
    return wrap(a / b);
}

// Usage
const color: Color = Color.Green;
console.log("Color:", color);

const result1 = divide(10, 2);
const result2 = divide(10, 0);

if (result1.success && result1.data) {
    console.log("10 / 2 =", result1.data);
}
if (!result2.success && result2.error) {
    console.log("Error:", result2.error);
}

// Generic array function
function first<T>(arr: T[]): T | undefined {
    return arr[0];
}

console.log("First number:", first([1, 2, 3]));
console.log("First string:", first(["a", "b", "c"]));
`,
  },
  {
    id: 'ts-classes',
    name: 'TypeScript: Classes & OOP',
    description: 'Abstract classes, interfaces, inheritance.',
    language: 'typescript',
    code: `// TypeScript OOP — classes, interfaces, abstract classes

interface Animal {
    name: string;
    sound(): string;
}

abstract class BaseAnimal implements Animal {
    constructor(public name: string) {}
    abstract sound(): string;
    describe(): string {
        return this.name + " says " + this.sound();
    }
}

class Dog extends BaseAnimal {
    constructor(name: string) {
        super(name);
    }
    sound(): string {
        return "Woof!";
    }
}

class Cat extends BaseAnimal {
    constructor(name: string) {
        super(name);
    }
    sound(): string {
        return "Meow!";
    }
}

const dog = new Dog("Rex");
const cat = new Cat("Whiskers");

console.log(dog.describe());
console.log(cat.describe());

// Type narrowing
function makeSound(animal: Animal): void {
    console.log(animal.name + ": " + animal.sound());
}

makeSound(dog);
makeSound(cat);
`,
  },
  {
    id: 'rust-hello',
    name: 'Rust: Hello World',
    description: 'Basic Rust program with functions and loops.',
    language: 'rust',
    code: `fn main() {
    println!("Hello from Rust!");

    let name = "World";
    println!("Hello, {}!", name);

    let result = add(3, 4);
    println!("3 + 4 = {}", result);

    for i in 1..=3 {
        println!("Count: {}", i);
    }
}

fn add(a: i32, b: i32) -> i32 {
    a + b
}
`,
  },
  {
    id: 'rust-structs',
    name: 'Rust: Structs & Enums',
    description: 'Structs, enums, impl blocks, pattern matching.',
    language: 'rust',
    code: `// Rust structs, enums, and pattern matching

struct Person {
    name: String,
    age: u32,
}

impl Person {
    fn new(name: &str, age: u32) -> Self {
        Person { name: String::from(name), age }
    }

    fn greet(&self) -> String {
        format!("Hello, I'm {} and I'm {} years old", self.name, self.age)
    }
}

enum Status {
    Idle,
    Running(String),
    Done(u32),
}

fn describe(status: Status) -> String {
    match status {
        Status::Idle => "Idle".to_string(),
        Status::Running(task) => format!("Running: {}", task),
        Status::Done(code) => format!("Done with code {}", code),
    }
}

fn main() {
    let alice = Person::new("Alice", 30);
    println!("{}", alice.greet());

    let s1 = Status::Idle;
    let s2 = Status::Running("compile".to_string());
    let s3 = Status::Done(0);

    println!("{}", describe(s1));
    println!("{}", describe(s2));
    println!("{}", describe(s3));

    // Vectors
    let fruits = vec!["apple", "banana", "cherry"];
    for (i, fruit) in fruits.iter().enumerate() {
        println!("{}: {}", i, fruit);
    }

    // Option type
    let maybe: Option<i32> = Some(42);
    match maybe {
        Some(val) => println!("Got value: {}", val),
        None => println!("Got nothing"),
    }
}
`,
  },
  {
    id: 'rust-ownership',
    name: 'Rust: Ownership & Traits',
    description: 'Traits, generics, ownership, borrowing.',
    language: 'rust',
    code: `// Rust ownership, borrowing, and traits

trait Area {
    fn area(&self) -> f64;
}

struct Rectangle {
    width: f64,
    height: f64,
}

struct Circle {
    radius: f64,
}

impl Area for Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }
}

impl Area for Circle {
    fn area(&self) -> f64 {
        3.14159 * self.radius * self.radius
    }
}

fn print_area<T: Area>(shape: &T) {
    println!("Area: {:.2}", shape.area());
}

fn main() {
    let rect = Rectangle { width: 5.0, height: 3.0 };
    let circ = Circle { radius: 2.0 };

    print_area(&rect);
    print_area(&circ);

    // Ownership and borrowing
    let s1 = String::from("hello");
    let s2 = s1.clone();  // clone to keep ownership
    let len = calculate_length(&s1);  // borrow
    println!("The length of '{}' is {}", s2, len);

    // Mutable borrow
    let mut s3 = String::from("hello");
    append_world(&mut s3);
    println!("{}", s3);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}

fn append_world(s: &mut String) {
    s.push_str(", world!");
}
`,
  },
  {
    id: 'ruby-hello',
    name: 'Ruby: Hello World',
    description: 'Basic Ruby with methods and blocks.',
    language: 'ruby',
    code: `# Ruby 3.3 — runs with ruby
def add(a, b)
  a + b
end

puts "Hello from Ruby!"
name = "World"
puts "Hello, #{name}!"
result = add(3, 4)
puts "3 + 4 = #{result}"
3.times do |i|
  puts "Count: #{i + 1}"
end
`,
  },
  {
    id: 'ruby-classes',
    name: 'Ruby: Classes & Blocks',
    description: 'Classes, modules, blocks, iterators.',
    language: 'ruby',
    code: `# Ruby OOP and blocks

class Person
  attr_accessor :name, :age

  def initialize(name, age)
    @name = name
    @age = age
  end

  def greet
    "Hello, I'm #{@name} and I'm #{@age} years old"
  end

  def to_s
    "Person(name=#{@name}, age=#{@age})"
  end
end

class Student < Person
  attr_accessor :major

  def initialize(name, age, major)
    super(name, age)
    @major = major
  end

  def greet
    super + ". I study #{@major}."
  end
end

alice = Person.new("Alice", 30)
puts alice.greet
puts alice.to_s

bob = Student.new("Bob", 20, "Computer Science")
puts bob.greet

# Blocks and iterators
fruits = ["apple", "banana", "cherry"]
fruits.each_with_index do |fruit, i|
  puts "#{i + 1}. #{fruit.capitalize}"
end

# Hash
prices = { "apple" => 1.5, "banana" => 0.5, "cherry" => 3.0 }
total = prices.values.sum
puts "Total: $#{total}"

# Map/select
numbers = [1, 2, 3, 4, 5]
doubled = numbers.map { |n| n * 2 }
evens = numbers.select(&:even?)
puts "Doubled: #{doubled}"
puts "Evens: #{evens}"
`,
  },
  {
    id: 'ruby-metaprogramming',
    name: 'Ruby: Procs & Lambdas',
    description: 'Procs, lambdas, symbols, enumerable.',
    language: 'ruby',
    code: `# Ruby procs, lambdas, and functional style

# Proc
square = Proc.new { |x| x * x }
puts "Square of 5: #{square.call(5)}"

# Lambda
add = ->(a, b) { a + b }
puts "3 + 4 = #{add.call(3, 4)}"

# Difference: lambda checks arity, proc doesn't
# add.call(1)  # would raise ArgumentError

# Using & to convert proc to block
numbers = [1, 2, 3, 4, 5]
double = Proc.new { |x| x * 2 }
puts "Doubled: #{numbers.map(&double).inspect}"

# reduce/inject
sum = numbers.reduce(0) { |acc, n| acc + n }
product = numbers.reduce(1) { |acc, n| acc * n }
puts "Sum: #{sum}, Product: #{product}"

# group_by
words = ["apple", "bat", "cat", "ant", "ball"]
grouped = words.group_by { |w| w[0] }
puts "Grouped: #{grouped.inspect}"

# sort_by
sorted = words.sort_by { |w| w.length }
puts "Sorted by length: #{sorted.inspect}"

# flatten, compact, uniq
nested = [1, [2, 3], [4, [5, 6]], nil, 1, 2]
puts "Flattened: #{nested.flatten.inspect}"
puts "Compact: #{nested.compact.inspect}"
puts "Uniq: #{nested.flatten.uniq.inspect}"
`,
  },
  {
    id: 'swift-hello',
    name: 'Swift: Hello World',
    description: 'Basic Swift with functions and loops.',
    language: 'swift',
    code: `// Swift 5.10 — runs with swift

func add(_ a: Int, _ b: Int) -> Int {
    return a + b
}

print("Hello from Swift!")
let name = "World"
print("Hello, \\(name)!")
let result = add(3, 4)
print("3 + 4 = \\(result)")
for i in 1...3 {
    print("Count: \\(i)")
}
`,
  },
  {
    id: 'swift-classes',
    name: 'Swift: Classes & Structs',
    description: 'Classes, structs, protocols, extensions.',
    language: 'swift',
    code: `// Swift classes, structs, and protocols

protocol Greetable {
    func greet() -> String
}

struct Person: Greetable {
    let name: String
    let age: Int

    func greet() -> String {
        return "Hello, I'm \\(name) and I'm \\(age) years old"
    }
}

class Student: Greetable {
    let name: String
    let age: Int
    let major: String

    init(name: String, age: Int, major: String) {
        self.name = name
        self.age = age
        self.major = major
    }

    func greet() -> String {
        return "Hi, I'm \\(name). I study \\(major)."
    }
}

let alice = Person(name: "Alice", age: 30)
print(alice.greet())

let bob = Student(name: "Bob", age: 20, major: "Computer Science")
print(bob.greet())

// Array operations
let numbers = [1, 2, 3, 4, 5]
let doubled = numbers.map { $0 * 2 }
let sum = numbers.reduce(0, +)
let evens = numbers.filter { $0 % 2 == 0 }
print("Doubled: \\(doubled)")
print("Sum: \\(sum)")
print("Evens: \\(evens)")

// Optional handling
let maybeName: String? = "Alice"
if let name = maybeName {
    print("Name is: \\(name)")
}

// Dictionary
let prices = ["apple": 1.5, "banana": 0.5, "cherry": 3.0]
for (fruit, price) in prices {
    print("\\(fruit): $\\(price)")
}
`,
  },
  {
    id: 'swift-advanced',
    name: 'Swift: Generics & Enums',
    description: 'Generics, enums with associated values, pattern matching.',
    language: 'swift',
    code: `// Swift generics and advanced enums

enum Result<T> {
    case success(T)
    case failure(String)
}

enum Status {
    case idle
    case running(String)
    case done(Int)
}

func describe(_ status: Status) -> String {
    switch status {
    case .idle:
        return "Idle"
    case .running(let task):
        return "Running: \\(task)"
    case .done(let code):
        return "Done with code \\(code)"
    }
}

// Generic function
func first<T>(_ array: [T]) -> T? {
    return array.first
}

// Usage
let s1 = Status.idle
let s2 = Status.running("compile")
let s3 = Status.done(0)

print(describe(s1))
print(describe(s2))
print(describe(s3))

// Generics
let firstNum = first([1, 2, 3])
let firstStr = first(["a", "b", "c"])
print("First number: \\(firstNum ?? -1)")
print("First string: \\(firstStr ?? "none")")

// Result enum
func divide(_ a: Int, _ b: Int) -> Result<Int> {
    if b == 0 {
        return .failure("Division by zero")
    }
    return .success(a / b)
}

let result1 = divide(10, 2)
let result2 = divide(10, 0)

switch result1 {
case .success(let val):
    print("10 / 2 = \\(val)")
case .failure(let err):
    print("Error: \\(err)")
}

switch result2 {
case .success(let val):
    print("10 / 0 = \\(val)")
case .failure(let err):
    print("Error: \\(err)")
}
`,
  },
  {
    id: 'lua-hello',
    name: 'Lua: Hello World',
    description: 'Basic Lua with functions and loops.',
    language: 'lua',
    code: `-- Lua 5.4 — runs with lua
local function add(a, b)
    return a + b
end

print("Hello from Lua!")
local name = "World"
print("Hello, " .. name .. "!")
local result = add(3, 4)
print("3 + 4 = " .. result)
for i = 1, 3 do
    print("Count: " .. i)
end
`,
  },
  {
    id: 'lua-tables',
    name: 'Lua: Tables & OOP',
    description: 'Tables, metatables, OOP, closures.',
    language: 'lua',
    code: `-- Lua tables, metatables, and OOP

-- Tables as arrays
local fruits = {"apple", "banana", "cherry"}
for i, fruit in ipairs(fruits) do
    print(i .. ". " .. fruit)
end

-- Tables as dictionaries
local prices = {apple = 1.5, banana = 0.5, cherry = 3.0}
local total = 0
for fruit, price in pairs(prices) do
    print(fruit .. ": $" .. price)
    total = total + price
end
print("Total: $" .. total)

-- OOP with metatables
local Animal = {}
Animal.__index = Animal

function Animal.new(name, sound)
    local self = setmetatable({}, Animal)
    self.name = name
    self.sound = sound
    return self
end

function Animal:speak()
    return self.name .. " says " .. self.sound
end

-- Inheritance
local Dog = setmetatable({}, {__index = Animal})
Dog.__index = Dog

function Dog.new(name)
    local self = Animal.new(name, "Woof")
    return setmetatable(self, Dog)
end

function Dog:fetch()
    return self.name .. " fetches the ball!"
end

local rex = Dog.new("Rex")
print(rex:speak())
print(rex:fetch())

-- Closures
local function counter()
    local count = 0
    return function()
        count = count + 1
        return count
    end
end

local c = counter()
print("Counter: " .. c())
print("Counter: " .. c())
print("Counter: " .. c())
`,
  },
  {
    id: 'lua-coroutines',
    name: 'Lua: Coroutines & String',
    description: 'Coroutines, string manipulation, math.',
    language: 'lua',
    code: `-- Lua coroutines and string operations

-- Coroutines (generators)
local function range(start, stop)
    return coroutine.create(function()
        for i = start, stop do
            coroutine.yield(i)
        end
    end)
end

local co = range(1, 5)
while true do
    local ok, val = coroutine.resume(co)
    if not ok or val == nil then break end
    print("Yielded: " .. val)
end

-- String manipulation
local s = "Hello, World!"
print("Upper: " .. string.upper(s))
print("Lower: " .. string.lower(s))
print("Reverse: " .. string.reverse(s))
print("Length: " .. #s)
print("Sub: " .. string.sub(s, 1, 5))
print("Find: " .. tostring(string.find(s, "World")))

-- String format
local name = "Alice"
local age = 30
print(string.format("Name: %s, Age: %d", name, age))

-- Math
print("Pi: " .. math.pi)
print("Random: " .. math.random(1, 100))
print("Floor: " .. math.floor(3.7))
print("Ceil: " .. math.ceil(3.2))

-- Table sort
local nums = {5, 2, 8, 1, 9, 3}
table.sort(nums)
print("Sorted: " .. table.concat(nums, ", "))

-- pcall (error handling)
local ok, err = pcall(function()
    error("Something went wrong!")
end)
if not ok then
    print("Caught error: " .. err)
end
`,
  },
  {
    id: 'perl-hello',
    name: 'Perl: Hello World',
    description: 'Basic Perl with subs, scalars, loops.',
    language: 'perl',
    code: `#!/usr/bin/perl
use strict;
use warnings;

sub add {
    return $_[0] + $_[1];
}

print "Hello from Perl!\n";
my $name = "World";
print "Hello, $name!\n";
my $result = add(3, 4);
print "3 + 4 = $result\n";
for my $i (1..3) {
    print "Count: $i\n";
}
`,
  },
  {
    id: 'perl-data',
    name: 'Perl: Arrays & Hashes',
    description: 'Arrays, hashes, references, regex.',
    language: 'perl',
    code: `#!/usr/bin/perl
use strict;
use warnings;

# Arrays
my @fruits = ("apple", "banana", "cherry");
for my $i (0..$#fruits) {
    print "$i: $fruits[$i]\n";
}

# Array functions
my @nums = (5, 2, 8, 1, 9, 3);
my @sorted = sort { $a <=> $b } @nums;
print "Sorted: @sorted\n";
my @reversed = reverse @nums;
print "Reversed: @reversed\n";
my $sum = 0;
$sum += $_ for @nums;
print "Sum: $sum\n";

# Hashes
my %prices = (apple => 1.5, banana => 0.5, cherry => 3.0);
for my $fruit (sort keys %prices) {
    print "$fruit: \$$prices{$fruit}\n";
}

# References
my $person = {
    name => "Alice",
    age => 30,
    hobbies => ["reading", "coding"],
};
print "\nPerson: $person->{name}, age $person->{age}\n";
print "Hobbies: @{$person->{hobbies}}\n";

# Regex
my $text = "Hello, World! 12345";
if ($text =~ /(\w+), (\w+)! (\d+)/) {
    print "Match: $1, $2, $3\n";
}
$text =~ s/World/Perl/;
print "Replaced: $text\n";

# Map/grep
my @upper = map { uc($_) } @fruits;
print "Uppercase: @upper\n";
my @long = grep { length($_) > 5 } @fruits;
print "Long (>5): @long\n";
`,
  },
  {
    id: 'perl-oop',
    name: 'Perl: OOP & File I/O',
    description: 'Packages, bless, file operations.',
    language: 'perl',
    code: `#!/usr/bin/perl
use strict;
use warnings;

# OOP with bless
package Animal;

sub new {
    my ($class, %args) = @_;
    my $self = bless \%args, $class;
    return $self;
}

sub name { return shift->{name}; }
sub sound { return shift->{sound}; }

sub speak {
    my $self = shift;
    return $self->{name} . " says " . $self->{sound};
}

package Dog;
our @ISA = ('Animal');

sub new {
    my ($class, $name) = @_;
    return $class->SUPER::new(name => $name, sound => "Woof");
}

sub fetch {
    my $self = shift;
    return $self->{name} . " fetches the ball!";
}

package main;

my $dog = Dog->new("Rex");
print $dog->speak(), "\n";
print $dog->fetch(), "\n";

# File I/O
my $filename = "/tmp/perl_test.txt";
open(my $fh, '>', $filename) or die "Cannot open $filename: $!";
print $fh "Hello from file!\n";
print $fh "Line 2\n";
close($fh);

print "\nReading file:\n";
open(my $in, '<', $filename) or die "Cannot read $filename: $!";
while (my $line = <$in>) {
    chomp $line;
    print "  > $line\n";
}
close($in);
unlink($filename);
print "File deleted.\n";
`,
  },
  {
    id: 'ps-hello',
    name: 'PowerShell: Hello World',
    description: 'Basic PowerShell with functions and loops.',
    language: 'powershell',
    code: `# PowerShell 7.4 — runs with pwsh

function Add($a, $b) {
    return $a + $b
}

Write-Host "Hello from PowerShell!"
$name = "World"
Write-Host "Hello, $name!"
$result = Add 3 4
Write-Host "3 + 4 = $result"
for ($i = 1; $i -le 3; $i++) {
    Write-Host "Count: $i"
}
`,
  },
  {
    id: 'ps-objects',
    name: 'PowerShell: Objects & Pipes',
    description: 'Pipelines, cmdlets, objects, formatting.',
    language: 'powershell',
    code: `# PowerShell objects, pipelines, and cmdlets

# Arrays
$fruits = @("apple", "banana", "cherry")
$fruits | ForEach-Object { Write-Host "Fruit: $_" }
$fruits | Where-Object { $_.Length -gt 5 } | ForEach-Object { Write-Host "Long: $_" }

# Hashtables
$prices = @{
    apple = 1.5
    banana = 0.5
    cherry = 3.0
}
$prices.GetEnumerator() | ForEach-Object {
    Write-Host "$($_.Key): $$($_.Value)"
}

# Custom objects
$people = @(
    [PSCustomObject]@{Name="Alice"; Age=30}
    [PSCustomObject]@{Name="Bob"; Age=25}
    [PSCustomObject]@{Name="Charlie"; Age=35}
)

# Sort and filter
$people | Sort-Object Age | ForEach-Object {
    Write-Host "$($_.Name) is $($_.Age) years old"
}

$youngest = $people | Sort-Object Age | Select-Object -First 1
Write-Host "Youngest: $($youngest.Name)"

# String operations
$text = "Hello, World!"
Write-Host "Upper: $($text.ToUpper())"
Write-Host "Lower: $($text.ToLower())"
Write-Host "Length: $($text.Length)"

# Math
Write-Host "Random: $(Get-Random -Min 1 -Max 100)"
Write-Host "Pi: $([Math]::Pi)"

# Try/Catch
try {
    $null = 1 / 0
} catch {
    Write-Host "Caught: $($_.Exception.Message)"
}
`,
  },
  {
    id: 'ps-files',
    name: 'PowerShell: Files & Strings',
    description: 'File I/O, regex, environment vars.',
    language: 'powershell',
    code: `# PowerShell file operations and string manipulation

# Create and write to file
$filePath = "/tmp/ps_test.txt"
$content = "Hello from PowerShell!\nLine 2\nLine 3"
$content | Out-File -FilePath $filePath -Encoding UTF8
Write-Host "File written: $filePath"

# Read file
$lines = Get-Content $filePath
Write-Host "Lines read: $($lines.Count)"
$lines | ForEach-Object { Write-Host "  > $_" }

# Append
"Line 4" | Add-Content -FilePath $filePath
Write-Host "After append:"
Get-Content $filePath | ForEach-Object { Write-Host "  > $_" }

# File info
$fileInfo = Get-Item $filePath
Write-Host "Size: $($fileInfo.Length) bytes"

# Clean up
Remove-Item $filePath
Write-Host "File deleted."

# Regex
$text = "Contact: alice@example.com, bob@test.org"
$matches = [regex]::Matches($text, "(\w+)@(\w+\.\w+)")
foreach ($m in $matches) {
    Write-Host "Email: $($m.Value)"
    Write-Host "  User: $($m.Groups[1].Value)"
    Write-Host "  Domain: $($m.Groups[2].Value)"
}

# Environment
Write-Host "HOME: $env:HOME"
Write-Host "PATH: $env:PATH".Substring(0, 50) + "..."

# Date
$now = Get-Date
Write-Host "Date: $($now.ToString('yyyy-MM-dd HH:mm:ss'))"
`,
  },
  {
    id: 'bash-hello',
    name: 'Bash: Hello World',
    description: 'Basic Bash with functions, variables, loops.',
    language: 'bash',
    code: `#!/bin/bash

add() {
    echo $(( $1 + $2 ))
}

echo "Hello from Bash!"
name="World"
echo "Hello, $name!"
result=$(add 3 4)
echo "3 + 4 = $result"
for i in 1 2 3; do
    echo "Count: $i"
done
`,
  },
  {
    id: 'bash-strings',
    name: 'Bash: Strings & Arrays',
    description: 'String manipulation, arrays, conditionals.',
    language: 'bash',
    code: `#!/bin/bash

# String operations
text="Hello, World!"
echo "Upper: $(echo $text | tr a-z A-Z)"
echo "Lower: $(echo $text | tr A-Z a-z)"
echo "Length: $(echo -n $text | wc -c)"
echo "Substring: $(echo $text | cut -c1-5)"
echo "Replace: $(echo $text | sed 's/World/Bash/')"

# Arrays
fruits=("apple" "banana" "cherry" "date")
echo "Array: \${fruits[@]}"
echo "Count: \${#fruits[@]}"
idx=0
for f in "\${fruits[@]}"; do
    echo "  $idx: $f"
    idx=$((idx + 1))
done

# Array operations
nums=(5 2 8 1 9 3)
sorted=($(printf '%s\n' "\${nums[@]}" | sort -n))
echo "Sorted: \${sorted[@]}"

# Conditionals
age=20
if [ $age -ge 18 ]; then
    echo "Adult"
elif [ $age -ge 13 ]; then
    echo "Teenager"
else
    echo "Child"
fi

# Case statement
day="Monday"
case $day in
    Monday|Tuesday|Wednesday|Thursday|Friday)
        echo "Weekday" ;;
    Saturday|Sunday)
        echo "Weekend" ;;
    *)
        echo "Unknown" ;;
esac

# Reading input from a file
echo "line1\nline2\nline3" > /tmp/bash_test.txt
while IFS= read -r line; do
    echo "  > $line"
done < /tmp/bash_test.txt
rm /tmp/bash_test.txt
`,
  },
  {
    id: 'bash-system',
    name: 'Bash: System & Functions',
    description: 'File ops, process management, networking.',
    language: 'bash',
    code: `#!/bin/bash

# System info
echo "OS: $(uname -s)"
echo "Hostname: $(hostname)"
echo "User: $(whoami)"
echo "Date: $(date)"
echo "Uptime: $(uptime -p)"

# Disk usage
echo ""
echo "Disk usage:"
df -h / | tail -1 | awk '{print "  Total: "$2"  Used: "$3"  Free: "$4}'

# Memory
echo ""
echo "Memory:"
free -h | head -2

# Functions with local variables
calculate_area() {
    local width=$1
    local height=$2
    local area=$((width * height))
    echo $area
}

rect_area=$(calculate_area 5 3)
echo ""
echo "Rectangle area (5x3): $rect_area"

# Recursive function
factorial() {
    if [ $1 -le 1 ]; then
        echo 1
    else
        local prev=$(factorial $(( $1 - 1 )))
        echo $(( $1 * prev ))
    fi
}

echo "5! = $(factorial 5)"

# String splitting
csv="apple,banana,cherry"
IFS=',' read -ra items <<< "$csv"
for item in "\${items[@]}"; do
    echo "Item: $item"
done

# Find files
echo ""
echo "Temp files:"
find /tmp -maxdepth 1 -name "*.txt" 2>/dev/null | head -3

# Count lines in output
echo ""
echo "Running processes: $(ps aux | wc -l)"
`,
  },
]


/* ------------------------------------------------------------------ */
/* Kotlin Android default project template                            */
/* ------------------------------------------------------------------ */

export const KOTLIN_ANDROID_TEMPLATE: Record<string, string> = {
  'app/src/main/java/com/example/app/MainActivity.kt': `package com.example.app

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private var counter = 0
    private lateinit var counterText: TextView
    private lateinit var incrementBtn: Button
    private lateinit var resetBtn: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        counterText = findViewById(R.id.counterText)
        incrementBtn = findViewById(R.id.incrementBtn)
        resetBtn = findViewById(R.id.resetBtn)

        updateCounter()

        incrementBtn.setOnClickListener {
            counter++
            updateCounter()
        }

        resetBtn.setOnClickListener {
            counter = 0
            updateCounter()
            Toast.makeText(this, "Counter reset", Toast.LENGTH_SHORT).show()
        }
    }

    private fun updateCounter() {
        counterText.text = "Count: " + counter
    }
}
`,
  'app/src/main/res/layout/activity_main.xml': `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center"
    android:padding="24dp">

    <TextView
        android:id="@+id/counterText"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Count: 0"
        android:textSize="48sp"
        android:textStyle="bold"
        android:layout_marginBottom="32dp" />

    <Button
        android:id="@+id/incrementBtn"
        android:layout_width="200dp"
        android:layout_height="wrap_content"
        android:text="Increment"
        android:textSize="16sp" />

    <Button
        android:id="@+id/resetBtn"
        android:layout_width="200dp"
        android:layout_height="wrap_content"
        android:text="Reset"
        android:textSize="16sp"
        android:layout_marginTop="16dp" />

</LinearLayout>
`,
  'app/src/main/res/values/strings.xml': `<resources>
    <string name="app_name">My Kotlin App</string>
</resources>
`,
  'app/src/main/res/values/colors.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="purple_500">#FF6200EE</color>
    <color name="purple_700">#FF3700B3</color>
    <color name="teal_200">#FF03DAC5</color>
    <color name="teal_700">#FF018786</color>
    <color name="black">#FF000000</color>
    <color name="white">#FFFFFFFF</color>
</resources>
`,
  'app/src/main/res/values/themes.xml': `<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="Theme.MyApp" parent="Theme.MaterialComponents.DayNight.DarkActionBar">
        <item name="colorPrimary">@color/purple_500</item>
        <item name="colorPrimaryVariant">@color/purple_700</item>
        <item name="colorOnPrimary">@color/white</item>
    </style>
</resources>
`,
  'app/src/main/AndroidManifest.xml': `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.app">

    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:theme="@style/Theme.MyApp">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
  'app/build.gradle.kts': `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
}
`,
  'settings.gradle.kts': `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MyKotlinApp"
include(":app")
`,
  'build.gradle.kts': `plugins {
    id("com.android.application") version "8.1.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.0" apply false
}
`,
  'gradle.properties': `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`,
}
