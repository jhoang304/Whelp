from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileRequired, FileAllowed
from app.api.aws_helpers import ALLOWED_EXTENSIONS


class ImageUploadForm(FlaskForm):
    image = FileField(
        "image",
        validators=[
            FileRequired(message="Please choose an image file to upload."),
            FileAllowed(
                sorted(ALLOWED_EXTENSIONS),
                message="Only png, jpg, jpeg, gif, and webp images are allowed.",
            ),
        ],
    )
