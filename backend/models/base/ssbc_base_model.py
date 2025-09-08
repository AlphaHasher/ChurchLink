from typing import Any, Annotated
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, GetCoreSchemaHandler, GetJsonSchemaHandler
from pydantic_core import core_schema
from bson import ObjectId


class _ObjectIdPydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        def validate_from_str(v: str) -> ObjectId:
            try:
                return ObjectId(v)
            except Exception:
                raise ValueError(f"Invalid ObjectId string format: '{v}'")

        from_str_schema = core_schema.chain_schema(
            [
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(validate_from_str),
            ]
        )

        return core_schema.union_schema(
            [
                core_schema.is_instance_schema(ObjectId),
                from_str_schema,
            ],
            serialization=core_schema.plain_serializer_function_ser_schema(lambda x: str(x)),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> dict:
        json_schema = handler(core_schema.str_schema())
        json_schema.update({'type': 'string', 'format': 'objectid'})
        return json_schema


# Reusable annotated type for Mongo ObjectIds
PydanticObjectId = Annotated[ObjectId, _ObjectIdPydanticAnnotation]


class SSBCBaseModel(BaseModel):
    """Project-wide Pydantic base model with sensible defaults."""

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

    def model_dump_mongo(self) -> dict:
        """Dump with Mongo-friendly field names (e.g., uses `_id` alias)."""
        return self.model_dump(by_alias=True)


class MongoBaseModel(SSBCBaseModel):
    """Common Mongo document fields for models that live in MongoDB."""

    id: PydanticObjectId = Field(default_factory=ObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)




