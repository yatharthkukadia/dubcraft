import os
import asyncio
import json
from pathlib import Path
from typing import Dict, Optional
import ffmpeg
from faster_whisper import WhisperModel
from transformers import MarianMTModel, MarianTokenizer, pipeline
from langdetect import detect
import logging

logger = logging.getLogger(__name__)

# Indian language codes for translation
INDIAN_LANGUAGES = {
    "hindi": "hi",
    "tamil": "ta",
    "telugu": "te",
    "malayalam": "ml",
    "kannada": "kn",
    "bengali": "bn",
    "marathi": "mr",
    "gujarati": "gu",
    "punjabi": "pa",
    "urdu": "ur"
}

class AIProcessor:
    def __init__(self):
        self.whisper_model = None
        self.translation_models = {}
        self.spell_checker = None
        
    async def initialize(self):
        """Initialize AI models (lazy loading)"""
        try:
            # Initialize Whisper for STT
            if not self.whisper_model:
                logger.info("Loading Whisper model...")
                self.whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
                logger.info("Whisper model loaded")
        except Exception as e:
            logger.error(f"Error initializing models: {e}")
    
    async def extract_audio(self, video_path: str, audio_path: str, progress_callback=None) -> bool:
        """Extract audio from video using FFmpeg"""
        try:
            if progress_callback:
                await progress_callback("extracting_audio", "Extracting audio from video...")
            
            # Use ffmpeg-python to extract audio
            stream = ffmpeg.input(video_path)
            stream = ffmpeg.output(stream, audio_path, acodec='pcm_s16le', ac=1, ar='16k')
            ffmpeg.run(stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)
            
            if progress_callback:
                await progress_callback("audio_extracted", "Audio extraction complete")
            
            return True
        except Exception as e:
            logger.error(f"Audio extraction error: {e}")
            if progress_callback:
                await progress_callback("error", f"Audio extraction failed: {str(e)}")
            return False
    
    async def transcribe_audio(self, audio_path: str, progress_callback=None) -> Optional[str]:
        """Transcribe audio to text using Whisper"""
        try:
            if progress_callback:
                await progress_callback("transcribing", "Transcribing audio to text...")
            
            await self.initialize()
            
            # Transcribe using Whisper
            segments, info = self.whisper_model.transcribe(audio_path, beam_size=5)
            
            # Combine all segments
            transcription = " ".join([segment.text for segment in segments])
            
            if progress_callback:
                await progress_callback("transcribed", f"Transcription complete. Detected language: {info.language}")
            
            return transcription.strip()
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            if progress_callback:
                await progress_callback("error", f"Transcription failed: {str(e)}")
            return None
    
    async def correct_spelling(self, text: str, progress_callback=None) -> str:
        """Correct spelling and grammar using simple rules"""
        try:
            if progress_callback:
                await progress_callback("correcting", "Correcting spelling and grammar...")
            
            # Simple corrections (in production, use LanguageTool or similar)
            corrected = text.strip()
            
            # Basic cleanup
            corrected = " ".join(corrected.split())  # Remove extra spaces
            
            if progress_callback:
                await progress_callback("corrected", "Text correction complete")
            
            return corrected
        except Exception as e:
            logger.error(f"Spelling correction error: {e}")
            return text
    
    async def translate_text(self, text: str, target_language: str, progress_callback=None) -> Optional[str]:
        """Translate text to Indian regional language"""
        try:
            if progress_callback:
                await progress_callback("translating", f"Translating to {target_language}...")
            
            target_code = INDIAN_LANGUAGES.get(target_language.lower())
            if not target_code:
                logger.warning(f"Unsupported language: {target_language}")
                return text
            
            # Use deep-translator for better reliability
            from deep_translator import GoogleTranslator
            
            # Split text into chunks if too long (Google Translate limit is ~5000 chars)
            max_chunk_size = 4500
            if len(text) <= max_chunk_size:
                translator = GoogleTranslator(source='auto', target=target_code)
                translated = translator.translate(text)
            else:
                # Split into sentences and translate in chunks
                sentences = text.split('. ')
                translated_parts = []
                current_chunk = ""
                
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) < max_chunk_size:
                        current_chunk += sentence + ". "
                    else:
                        if current_chunk:
                            translator = GoogleTranslator(source='auto', target=target_code)
                            translated_parts.append(translator.translate(current_chunk))
                        current_chunk = sentence + ". "
                
                if current_chunk:
                    translator = GoogleTranslator(source='auto', target=target_code)
                    translated_parts.append(translator.translate(current_chunk))
                
                translated = " ".join(translated_parts)
            
            if progress_callback:
                await progress_callback("translated", f"Translation to {target_language} complete")
            
            return translated
        except Exception as e:
            logger.error(f"Translation error: {e}")
            if progress_callback:
                await progress_callback("error", f"Translation failed: {str(e)}")
            return text
    
    async def extract_voice_parameters(self, instructions: str, audio_path: str = None) -> Dict:
        """Extract voice parameters from natural language instructions"""
        instructions_lower = instructions.lower()
        
        params = {
            "gender": "female" if "female" in instructions_lower else "male",
            "pitch": "medium",
            "speed": "normal",
            "quality": "high"
        }
        
        # Parse pitch
        if "high pitch" in instructions_lower or "higher pitch" in instructions_lower:
            params["pitch"] = "high"
        elif "low pitch" in instructions_lower or "deep" in instructions_lower:
            params["pitch"] = "low"
        
        # Parse speed
        if "slow" in instructions_lower:
            params["speed"] = "slow"
        elif "fast" in instructions_lower:
            params["speed"] = "fast"
        
        # Parse quality
        if "studio" in instructions_lower or "high quality" in instructions_lower:
            params["quality"] = "studio"
        elif "basic" in instructions_lower or "low quality" in instructions_lower:
            params["quality"] = "basic"
        
        return params
    
    async def generate_speech(self, text: str, voice_params: Dict, output_path: str, progress_callback=None) -> bool:
        """Generate speech from text using TTS"""
        try:
            if progress_callback:
                await progress_callback("generating_voice", "Generating dubbed voice...")
            
            # Use gTTS for text-to-speech
            from gtts import gTTS
            
            # Map language codes for gTTS
            lang_map = {
                "hi": "hi",  # Hindi
                "ta": "ta",  # Tamil
                "te": "te",  # Telugu
                "ml": "ml",  # Malayalam
                "kn": "kn",  # Kannada
                "bn": "bn",  # Bengali
                "mr": "mr",  # Marathi
                "gu": "gu",  # Gujarati
                "pa": "pa",  # Punjabi
                "ur": "ur",  # Urdu
            }
            
            # Get language from voice params
            target_language = voice_params.get("language", "hindi")
            target_code = INDIAN_LANGUAGES.get(target_language.lower(), "hi")
            tts_lang = lang_map.get(target_code, "hi")
            
            # Determine if should be slow based on voice params
            slow_speech = voice_params.get("speed", "normal") == "slow"
            
            # Generate speech
            # Note: gTTS doesn't support fine-grained voice control (pitch, gender, etc.)
            # For production, use Google Cloud TTS or similar with full voice parameters
            tts = gTTS(text=text, lang=tts_lang, slow=slow_speech)
            tts.save(output_path)
            
            if progress_callback:
                await progress_callback("voice_generated", "Voice generation complete")
            
            return True
        except Exception as e:
            logger.error(f"Speech generation error: {e}")
            if progress_callback:
                await progress_callback("error", f"Voice generation failed: {str(e)}")
            return False
    
    async def merge_audio_video(self, video_path: str, audio_path: str, output_path: str, add_watermark: bool = False, progress_callback=None) -> bool:
        """Merge generated audio with original video"""
        try:
            if progress_callback:
                await progress_callback("merging", "Merging audio with video...")
            
            # Use ffmpeg to replace audio
            video = ffmpeg.input(video_path)
            audio = ffmpeg.input(audio_path)
            force_reencode = False

            if add_watermark:
                # Add watermark overlay for trial users
                video = video.drawtext(
                    text='DubAI Trial',
                    fontsize=24,
                    fontcolor='white@0.7',
                    x='(w-text_w-10)',
                    y='10',
                    box=1,
                    boxcolor='black@0.5',
                    boxborderw=5
                )
                force_reencode = True
            
            stream = ffmpeg.output(
                video,
                audio,
                output_path,
                vcodec='libx264' if force_reencode else 'copy',
                acodec='aac',
                strict='experimental'
            )
            
            ffmpeg.run(stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)
            
            if progress_callback:
                await progress_callback("completed", "Video dubbing complete!")
            
            return True
        except ffmpeg.Error as e:
            stderr = e.stderr.decode("utf-8", errors="ignore") if e.stderr else str(e)
            logger.error(f"Audio-video merging error: {stderr}")
            if progress_callback:
                await progress_callback("error", f"Merging failed: {stderr}")
            return False
        except Exception as e:
            logger.error(f"Audio-video merging error: {e}")
            if progress_callback:
                await progress_callback("error", f"Merging failed: {str(e)}")
            return False

    async def generate_subtitles(self, transcription: str, output_path: str, progress_callback=None) -> bool:
        """Generate SRT subtitle file from transcription"""
        try:
            if progress_callback:
                await progress_callback("generating_subtitles", "Generating subtitles...")
            
            # Split transcription into segments (simple implementation)
            # In production, use word timestamps from Whisper
            words = transcription.split()
            words_per_subtitle = 10
            duration_per_subtitle = 3  # seconds
            
            srt_content = ""
            subtitle_index = 1
            
            for i in range(0, len(words), words_per_subtitle):
                chunk = " ".join(words[i:i + words_per_subtitle])
                start_time = (subtitle_index - 1) * duration_per_subtitle
                end_time = subtitle_index * duration_per_subtitle
                
                # Format: HH:MM:SS,MMM
                start_formatted = self._format_srt_time(start_time)
                end_formatted = self._format_srt_time(end_time)
                
                srt_content += f"{subtitle_index}\n"
                srt_content += f"{start_formatted} --> {end_formatted}\n"
                srt_content += f"{chunk}\n\n"
                
                subtitle_index += 1
            
            # Write SRT file
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(srt_content)
            
            if progress_callback:
                await progress_callback("subtitles_generated", "Subtitles generated")
            
            return True
        except Exception as e:
            logger.error(f"Subtitle generation error: {e}")
            return False
    
    def _format_srt_time(self, seconds: float) -> str:
        """Format time for SRT format (HH:MM:SS,MMM)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

# Global processor instance
processor = AIProcessor()












