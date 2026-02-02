import axios from 'axios';

export const getErrorMessages = (error: unknown): string[] => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // Server responded with a status other than 2xx range
      if (typeof error.response.data === 'string') {
        return [error.response.data];
      } else if (typeof error.response.data === 'object' && error.response.data !== null) {
        // Handle Django Rest Framework errors (e.g., validation errors)
        const messages: string[] = [];
        for (const key in error.response.data) {
          if (Object.prototype.hasOwnProperty.call(error.response.data, key)) {
            const element = error.response.data[key];
            if (Array.isArray(element)) {
              messages.push(...element.map((msg: string) => (key === 'non_field_errors' ? msg : `${key}: ${msg}`)));
            } else if (typeof element === 'string') {
              messages.push(`${key}: ${element}`);
            }
          }
        }
        if (messages.length > 0) {
          return messages;
        } else if (error.response.data.detail) {
          return [error.response.data.detail];
        }
      }
    } else if (error.request) {
      // Request was made but no response was received
      return ['No response from server. Please try again later.'];
    } else {
      // Something else happened while setting up the request
      return [error.message];
    }
  }
  return ['An unexpected error occurred.'];
};

