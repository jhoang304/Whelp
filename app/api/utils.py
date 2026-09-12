def error_messages(form_errors):
    """Flatten WTForms' {field: [messages]} into a plain list of messages."""
    messages = []
    for field in form_errors:
        for error in form_errors[field]:
            messages.append(error)
    return messages
