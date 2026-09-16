from pydantic import BaseModel, ConfigDict


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    number: int
    question_text: str
    answer_text: str
    image_ref: str | None
