/**
 * Default starter code for each supported language.
 *
 * Extracted from page.tsx so the project store can import these constants
 * to initialize per-language projects (each language gets its own isolated
 * workspace with its own default entry file + starter code).
 *
 * The constants are also re-exported from page.tsx for backward compat.
 */
import type { Language } from './languages'

export const DEFAULT_CODE = `# CodeHubz — Python 3 playground
# Press Run (or Ctrl/Cmd+Enter) to execute.

def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("world"))

# Interactive: type your name in the input bar below
# the console when prompted, then press Enter.
name = input("What's your name? ")
print(f"Nice to meet you, {name}!")
`

export const DEFAULT_JAVA_CODE = `// CodeHubz — Java 21 playground
// Press Run (or Ctrl/Cmd+Enter) to execute.
// The public class name is detected automatically.

public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, World!");

        // Use Scanner to read from stdin (interactive)
        var scanner = new java.util.Scanner(System.in);
        System.out.print("What's your name? ");
        String name = scanner.nextLine();
        System.out.println("Nice to meet you, " + name + "!");
    }
}
`

export const DEFAULT_C_CODE = `// CodeHubz — C (gcc 14) playground
// Press Run (or Ctrl/Cmd+Enter) to execute.
// Compiled with: gcc -std=c11 -Wall -O2 -lm

#include <stdio.h>

int main(void) {
    printf("Hello, World!\\n");

    // Use scanf to read from stdin (interactive)
    char name[64];
    printf("What's your name? ");
    scanf("%63s", name);
    printf("Nice to meet you, %s!\\n", name);

    return 0;
}
`

export const DEFAULT_CPP_CODE = `// CodeHubz — C++ (g++ 14, C++20) playground
// Press Run (or Ctrl/Cmd+Enter) to execute.
// Compiled with: g++ -std=c++20 -Wall -O2

#include <iostream>
#include <string>

int main() {
    std::cout << "Hello, World!" << std::endl;

    // Read from stdin (interactive)
    std::string name;
    std::cout << "What's your name? ";
    std::getline(std::cin, name);
    std::cout << "Nice to meet you, " << name << "!" << std::endl;

    return 0;
}
`

export const DEFAULT_R_CODE = `# CodeHubz — R 4.5 playground
# Press Run (or Ctrl/Cmd+Enter) to execute.

print("Hello, World!")

# Basic vector operations
x <- c(1, 2, 3, 4, 5)
print(paste("Mean:", mean(x)))
print(paste("Sum:", sum(x)))
print(paste("Squared:", paste(x^2, collapse=", ")))

# For interactive input, open "Program Input" below the editor,
# type your values (one per line), then Run.
# Or load the "R: Interactive Input" example from the Examples menu.
`

export const DEFAULT_JS_CODE = `// CodeHubz — JavaScript (Node.js 24) playground
// Press Run (or Ctrl/Cmd+Enter) to execute.
// Supports both CommonJS (require) and ES modules (import).

console.log("Hello, World!");

// Array methods — functional programming style
const nums = [1, 2, 3, 4, 5];
console.log("Sum:", nums.reduce((a, b) => a + b, 0));
console.log("Squared:", nums.map(n => n ** 2));

// Object destructuring
const user = { name: "Ada", age: 36 };
console.log(user.name + " is " + user.age + " years old.");

// For interactive input, open "Program Input" below the editor,
// type your values (one per line), then Run.
// Or load the "JS: Interactive Input" example from the Examples menu.
`

export const DEFAULT_PHP_CODE = `<?php
// CodeHubz — PHP 8.4 playground
// Press Run (or Ctrl/Cmd+Enter) to execute.

echo "Hello, World!\\n";

// Array functions
$nums = [1, 2, 3, 4, 5];
echo "Sum: " . array_sum($nums) . "\\n";
echo "Squared: " . implode(", ", array_map(fn($n) => $n * $n, $nums)) . "\\n";

// Interactive: type your name in the input bar below
echo "What's your name? ";
$name = trim(fgets(STDIN));
echo "Nice to meet you, $name!\\n";
`

export const DEFAULT_CSHARP_CODE = `// CodeHubz - C# (.NET 8) playground
// Press Run (or Ctrl/Cmd+Enter) to execute.

using System;
using System.Linq;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");

        // LINQ
        int[] nums = { 1, 2, 3, 4, 5 };
        Console.WriteLine("Sum: " + nums.Sum());
        Console.WriteLine("Squared: " + string.Join(", ", nums.Select(n => n * n)));

        // Interactive: type your name in the input bar
        Console.Write("What's your name? ");
        string name = Console.ReadLine();
        Console.WriteLine("Nice to meet you, " + name + "!");
    }
}
`

export const DEFAULT_DART_CODE = `// CodeHubz - Dart 3.13 playground
// Press Run (or Ctrl/Cmd+Enter) to execute.

import 'dart:io';

void main() {
  print('Hello, World!');

  // List methods
  var nums = [1, 2, 3, 4, 5];
  print('Sum: ' + nums.reduce((a, b) => a + b).toString());
  print('Squared: ' + nums.map((n) => n * n).join(', '));

  // Interactive: type your name in the input bar
  stdout.write("What's your name? ");
  var name = stdin.readLineSync() ?? '';
  print('Nice to meet you, ' + name + '!');
}
`

export const DEFAULT_HTML_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Web Page</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 400px;
      width: 90%;
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1.5rem; line-height: 1.6; }
    button {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover { transform: translateY(-2px); }
    #output { margin-top: 1rem; font-weight: bold; color: #667eea; }
  </style>
</head>
<body>
  <div class="card">
    <h1>👋 Hello, CodeHubz!</h1>
    <p>Edit this HTML and click Run to see your changes live in the preview.</p>
    <button onclick="document.getElementById('output').innerText = 'Clicked at ' + new Date().toLocaleTimeString()">
      Click Me
    </button>
    <p id="output"></p>
  </div>
</body>
</html>
`

export const DEFAULT_FLUTTER_CODE = `import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('My Flutter App')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Hello from Flutter!',
                style: TextStyle(fontSize: 24)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {},
                child: const Text('Click me'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}`

export const DEFAULT_KOTLIN_CODE = `// Kotlin/JVM console — runs with kotlinc 2.0.21
// Press Run (or Ctrl+Enter) to execute.

fun main() {
    println("Hello from Kotlin!")

    val name = "World"
    println("Hello, " + name + "!")

    val result = add(3, 4)
    println("3 + 4 = " + result)

    val person = Person("Alice", 30)
    println(person)
}

fun add(a: Int, b: Int): Int = a + b

data class Person(val name: String, val age: Int)
`

export const DEFAULT_GO_CODE = `// Go 1.23 — runs with go run
// Press Run (or Ctrl+Enter) to execute.

package main

import "fmt"

func main() {
        fmt.Println("Hello from Go!")

        name := "World"
        fmt.Println("Hello, " + name + "!")

        result := add(3, 4)
        fmt.Println("3 + 4 =", result)

        for i := 1; i <= 3; i++ {
                fmt.Printf("Count: %d\n", i)
        }
}

func add(a, b int) int {
        return a + b
}
`

export const DEFAULT_TS_CODE = `// TypeScript 5.x — runs with bun
// Press Run (or Ctrl+Enter) to execute.

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

// Union types
type Status = "idle" | "running" | "done";
let status: Status = "idle";
status = "running";
console.log("Status:", status);
`

export const DEFAULT_RUST_CODE = `// Rust 1.98 — runs with rustc
// Press Run (or Ctrl+Enter) to execute.

fn main() {
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
`

export const DEFAULT_RUBY_CODE = `# Ruby 3.3 — runs with ruby
# Press Run (or Ctrl+Enter) to execute.

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
`

export const DEFAULT_SWIFT_CODE = `// Swift 5.10 — runs with swift
// Press Run (or Ctrl+Enter) to execute.

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
`

export const DEFAULT_LUA_CODE = `-- Lua 5.4 — runs with lua
-- Press Run (or Ctrl+Enter) to execute.

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
`

export const DEFAULT_PERL_CODE = `#!/usr/bin/perl
# Perl 5.40 — runs with perl
# Press Run (or Ctrl+Enter) to execute.

use strict;
use warnings;

sub add {
    return $_[0] + $_[1];
}

print "Hello from Perl!\\n";
my $name = "World";
print "Hello, $name!\\n";
my $result = add(3, 4);
print "3 + 4 = $result\\n";
for my $i (1..3) {
    print "Count: $i\\n";
}
`

export const DEFAULT_PS_CODE = `# PowerShell 7.4 — runs with pwsh
# Press Run (or Ctrl+Enter) to execute.

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
`

export const DEFAULT_BASH_CODE = `#!/bin/bash
# Bash 5.2 — runs with bash
# Press Run (or Ctrl+Enter) to execute.

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
`

export const DEFAULT_FORTRAN_CODE = `! Fortran 14.2 — runs with gfortran
! Press Run (or Ctrl+Enter) to execute.

program main
    implicit none
    print *, "Hello from Fortran!"
    
    character(len=*), parameter :: name = "World"
    print *, "Hello, " // trim(name) // "!"
    
    integer :: result
    result = add(3, 4)
    print *, "3 + 4 = ", result
    
    integer :: i
    do i = 1, 3
        print *, "Count: ", i
    end do

contains
    integer function add(a, b)
        integer, intent(in) :: a, b
        add = a + b
    end function add
end program main
`

export const DEFAULT_COBOL_CODE = `      *> COBOL 3.2 — runs with GnuCOBOL
      *> Press Run (or Ctrl+Enter) to execute.

       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  NAME      PIC X(10) VALUE "World".
       01  RESULT    PIC 9(4).
       01  COUNTER   PIC 9(2).

       PROCEDURE DIVISION.
           DISPLAY "Hello from COBOL!".
           DISPLAY "Hello, " NAME "!".

           PERFORM ADD-NUMBERS.
           DISPLAY "3 + 4 = " RESULT.

           PERFORM VARYING COUNTER FROM 1 BY 1
               UNTIL COUNTER > 3
               DISPLAY "Count: " COUNTER
           END-PERFORM.

           STOP RUN.

       ADD-NUMBERS.
           ADD 3 TO 4 GIVING RESULT.
`

/**
 * Map of Language → default starter code.
 * Used by the project store to initialize each language's default entry file.
 */
export const DEFAULT_CODE_FOR_LANGUAGE: Record<Language, string> = {
  python: DEFAULT_CODE,
  java: DEFAULT_JAVA_CODE,
  c: DEFAULT_C_CODE,
  cpp: DEFAULT_CPP_CODE,
  r: DEFAULT_R_CODE,
  javascript: DEFAULT_JS_CODE,
  php: DEFAULT_PHP_CODE,
  csharp: DEFAULT_CSHARP_CODE,
  dart: DEFAULT_DART_CODE,
  flutter: DEFAULT_FLUTTER_CODE,
  html: DEFAULT_HTML_CODE,
  sql: DEFAULT_FLUTTER_CODE,  // SQL has no default starter code
  kotlin: DEFAULT_KOTLIN_CODE,
  go: DEFAULT_GO_CODE,
  typescript: DEFAULT_TS_CODE,
  rust: DEFAULT_RUST_CODE,
  ruby: DEFAULT_RUBY_CODE,
  swift: DEFAULT_SWIFT_CODE,
  lua: DEFAULT_LUA_CODE,
  perl: DEFAULT_PERL_CODE,
  powershell: DEFAULT_PS_CODE,
  bash: DEFAULT_BASH_CODE,
  fortran: DEFAULT_FORTRAN_CODE,
  cobol: DEFAULT_COBOL_CODE,
}

/** Get the default starter code for a language. */
export function getDefaultCode(lang: Language): string {
  return DEFAULT_CODE_FOR_LANGUAGE[lang] ?? ''
}
