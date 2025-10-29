from pydantic import BaseModel, Field
from datetime import datetime

# TODO: CONSIDER THIS MORE AND EXPAND GREATLY

class DiscountCode(BaseModel):
    id: str
    # Name represents a name of the code for easily selection
    name: str
    # Description represents the description so an admin can view the code and understand what its purpose is
    description: str
    # This is the actual code itself, that the user would type. E.G. 20FORTACOS
    code: str
    # Defines if bool is percentage off or not. If true, the numerical value will represent a percentage, else, a raw value of a discount
    is_percent: bool
    # Discount amount. E.g., "2.5" represents 2.5% off if is_percent and $2.50 off if is_percent is false
    discount: float
    # Date the discount expires
    expires: datetime
