import json
from urllib.parse import parse_qs, urlparse

from app.interview.stt_provider import DeepgramProvider


def test_deepgram_provider_uses_nova_live_interim_configuration():
    provider = DeepgramProvider("test-deepgram-key", model="nova-3")
    query = parse_qs(urlparse(provider.websocket_url).query)

    assert urlparse(provider.websocket_url).scheme == "wss"
    assert urlparse(provider.websocket_url).netloc == "api.deepgram.com"
    assert query["model"] == ["nova-3"]
    assert query["interim_results"] == ["true"]
    assert query["smart_format"] == ["true"]


def test_deepgram_provider_parses_interim_and_final_results():
    interim = DeepgramProvider._parse_result(
        json.dumps(
            {
                "type": "Results",
                "is_final": False,
                "speech_final": False,
                "channel": {"alternatives": [{"transcript": "I designed"}]},
            }
        )
    )
    final = DeepgramProvider._parse_result(
        json.dumps(
            {
                "type": "Results",
                "is_final": True,
                "speech_final": True,
                "channel": {"alternatives": [{"transcript": "I designed the API."}]},
            }
        )
    )

    assert interim is not None
    assert interim.text == "I designed"
    assert not interim.is_final
    assert final is not None
    assert final.text == "I designed the API."
    assert final.is_final
    assert final.speech_final
