from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://samsara:samsara@localhost:5432/samsara"
    debug: bool = False

    model_config = {"env_file": ".env"}


settings = Settings()
