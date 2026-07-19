---
name: hello
description: "A greeting skill that demonstrates the NPR skill cycle. Generates a personalized greeting message."
---

# Skill: hello

## Description
Generates a personalized greeting message. Demonstrates the full NPR skill cycle:
Noise (gather inputs) → Pattern (format message) → Return (output greeting).

## When to Use
- Testing the skill system
- Generating simple greeting messages
- Demonstrating NPR cycle semantics
- Validating skill execution pipeline

## NPR Cycle
- **Noise:** User name and optional greeting style
- **Pattern:** Compose greeting text from parameters
- **Return:** Formatted greeting string

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | true | Person to greet |
| style | string | false | Greeting style: formal, casual, enthusiastic (default: casual) |
| language | string | false | Language code for greeting (default: en) |

## Procedure
1. write greeting.txt Hello, {name}! Welcome to the NPR Skill System.

## Examples
```json
{
  "input": {
    "name": "Jelmer",
    "style": "casual"
  },
  "expected_output": {
    "success": true,
    "skill": "hello",
    "steps": [
      {
        "success": true,
        "type": "write",
        "file": "greeting.txt"
      }
    ]
  }
}
```
```json
{
  "input": {
    "name": "Team",
    "style": "formal"
  },
  "expected_output": {
    "success": true,
    "skill": "hello",
    "steps": [
      {
        "success": true,
        "type": "write",
        "file": "greeting.txt"
      }
    ]
  }
}
```
