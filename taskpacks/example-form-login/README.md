# Form Submission Example (Login Flow)

This taskpack demonstrates common browser automation patterns for interacting with forms, handling authentication flows, and navigating between pages.

It uses [the-internet.herokuapp.com/login](https://the-internet.herokuapp.com/login) as a target, which is a reliable public test site for automation practice.

## Automation Patterns Demonstrated

### 1. Navigating to a Form
Uses the `navigate` step to reach the target page.
```json
{
  "type": "navigate",
  "params": { "url": "https://the-internet.herokuapp.com/login" }
}
```

### 2. Filling Form Fields
Uses the `fill` step with CSS selectors and input parameterization.
```json
{
  "type": "fill",
  "params": {
    "target": { "kind": "css", "selector": "#username" },
    "value": "{{ inputs.username }}"
  }
}
```

### 3. Submitting the Form
Uses the `click` step to trigger the form submission via the submit button.
```json
{
  "type": "click",
  "params": {
    "target": { "kind": "css", "selector": "button[type='submit']" }
  }
}
```

### 4. Waiting for State Changes
Uses `wait_for` to ensure the post-submission confirmation element is visible before continuing.
```json
{
  "type": "wait_for",
  "params": {
    "target": { "kind": "css", "selector": "#flash" }
  }
}
```

### 5. Extracting Results
Uses `extract_text` to capture the confirmation message for the task output.
```json
{
  "type": "extract_text",
  "params": {
    "target": { "kind": "css", "selector": "#flash" },
    "out": "login_message"
  }
}
```

## Running the Example

Run with default credentials:
```bash
showrun run ./taskpacks/example-form-login
```

Run with specific (incorrect) credentials to see error handling:
```bash
showrun run ./taskpacks/example-form-login --inputs '{"username": "wrong", "password": "wrong"}'
```
