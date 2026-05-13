from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://samsara:samsara@localhost:5432/samsara"
    debug: bool = False
    anthropic_key: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
