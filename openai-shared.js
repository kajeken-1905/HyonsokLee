window.OpenAIConfig = {
  STORAGE_KEY: "mlb_chatbot_openai_key",
  MODEL_KEY: "mlb_chatbot_openai_model",
  IMAGE_MODEL_KEY: "mlb_image_openai_model",

  getApiKey() {
    return localStorage.getItem(this.STORAGE_KEY) || "";
  },

  getModel() {
    return localStorage.getItem(this.MODEL_KEY) || "gpt-4o-mini";
  },

  getImageModel() {
    return localStorage.getItem(this.IMAGE_MODEL_KEY) || "gpt-image-2";
  },

  saveApiKey(key) {
    localStorage.setItem(this.STORAGE_KEY, key);
  },

  saveModel(model) {
    localStorage.setItem(this.MODEL_KEY, model);
  },

  saveImageModel(model) {
    localStorage.setItem(this.IMAGE_MODEL_KEY, model);
  },
};
