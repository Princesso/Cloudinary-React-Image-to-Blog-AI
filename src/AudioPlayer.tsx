import { useEffect, useState, useRef } from "react";
import ReactPlayer from "react-player";

interface AudioPlayerProps {
  text: string;
}

const AudioPlayer = ({ text }: AudioPlayerProps) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousTextRef.current === text) {
      return;
    }
    previousTextRef.current = text;

    const controller = new AbortController();

    const generateAudio = async () => {
      setIsGenerating(true);
      setError(null);
      try {
        const response = await fetch("/api/generate-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Error generating audio");
        }

        const data = await response.json();
        setAudioUrl(data.audioUrl);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Error generating audio:", err);
        setError("Unable to generate audio for this story.");
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
      }
    };

    generateAudio();

    return () => controller.abort();
  }, [text]);

  return (
    <div className="audio-player">
      {isGenerating && <p className="audio-status">Generating audio narration...</p>}
      {error && <p className="audio-status" style={{ color: 'red' }}>{error}</p>}
      {audioUrl && <ReactPlayer width="100%" height="100%" src={audioUrl} controls />}
    </div>
  );
};

export default AudioPlayer;
