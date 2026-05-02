from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.facilities import router as facilities_router
from .routes.geo import router as geo_router

app = FastAPI(
    title="Samsara API",
    description="Geospatial Healthcare Discovery — Nepal",
    version="0.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(facilities_router)
app.include_router(geo_router)
