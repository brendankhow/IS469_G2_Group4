import json 
from typing import List

def format_response(response):
    # to remove all the ''' json
    formatted_response = response.replace("```", "").replace("json", "").strip()
    formatted_response_json = json.loads(formatted_response) 

    return formatted_response_json