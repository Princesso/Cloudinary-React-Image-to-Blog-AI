import { useReducer } from 'react';
import axios from 'axios';
import './App.css';
import { AdvancedImage } from '@cloudinary/react';
import { fill } from '@cloudinary/url-gen/actions/resize';
import { Cloudinary, CloudinaryImage } from '@cloudinary/url-gen';
import ReactMarkdown from 'react-markdown';
import AudioPlayer from './AudioPlayer';

const cld = new Cloudinary({
  cloud: {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? 'ai-devx-demo',
  },
});

interface CaptionResponse {
  public_id: string;
  caption: string;
  story: { content: string };
}

type State =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'ready'; cldImage: CloudinaryImage; caption: string; story: string }
  | { phase: 'error'; message: string };

type Action =
  | { type: 'UPLOAD_START' }
  | { type: 'UPLOAD_SUCCESS'; cldImage: CloudinaryImage; caption: string; story: string }
  | { type: 'UPLOAD_ERROR'; message: string };

const initialState: State = { phase: 'idle' };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'UPLOAD_START':
      return { phase: 'uploading' };
    case 'UPLOAD_SUCCESS':
      return {
        phase: 'ready',
        cldImage: action.cldImage,
        caption: action.caption,
        story: action.story,
      };
    case 'UPLOAD_ERROR':
      return { phase: 'error', message: action.message };
  }
}

const ImageUpload = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const uploadImage = async (file: File) => {
    dispatch({ type: 'UPLOAD_START' });

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post<CaptionResponse>('/api/caption', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const cldImage = cld.image(response.data.public_id);
      cldImage.resize(fill().width(500).height(500));

      dispatch({
        type: 'UPLOAD_SUCCESS',
        cldImage,
        caption: response.data.caption,
        story: response.data.story.content,
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error ?? error.message
        : 'Unexpected error uploading image';
      dispatch({ type: 'UPLOAD_ERROR', message: `Error uploading image: ${message}` });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage(file);
  };

  const isUploading = state.phase === 'uploading';

  return (
    <div className="app">
      <h1>Image to Blog AI</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <label className="custom-file-upload">
          <input type="file" accept="image/*" onChange={handleImageChange} />
          Choose File
        </label>
      </form>
      {isUploading && <div className="spinner"></div>}
      {state.phase === 'error' && <p style={{ color: 'red' }}>{state.message}</p>}
      {state.phase === 'ready' && (
        <>
          <AdvancedImage cldImg={state.cldImage} alt={state.caption} />
          <AudioPlayer text={state.story} />
          <ReactMarkdown>{state.story}</ReactMarkdown>
        </>
      )}
    </div>
  );
};

export default ImageUpload;
