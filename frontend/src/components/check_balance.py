
file_path = r"e:\ATSN\Agent_Emily\frontend\src\components\ATSNChatbot.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

stack = []
for i, char in enumerate(text):
    if char in "({[":
        stack.append((char, i))
    elif char in ")}]":
        if not stack:
            print(f"Error: Extra '{char}' at position {i}")
            # Find line number
            line_num = text[:i].count('\n') + 1
            print(f"Line: {line_num}")
            break
        
        last, idx = stack.pop()
        match = {'(': ')', '{': '}', '[': ']'}[last]
        if char != match:
            print(f"Error: Mismatched '{char}' at {i} (Line {text[:i].count('\n') + 1}). Expected '{match}' for '{last}' at {idx} (Line {text[:idx].count('\n') + 1})")
            break

if stack:
    print(f"Error: Unclosed {len(stack)} items.")
    for char, idx in stack[:5]:
        print(f"Unclosed '{char}' at {idx} (Line {text[:idx].count('\n') + 1})")
else:
    print("Balance OK")
