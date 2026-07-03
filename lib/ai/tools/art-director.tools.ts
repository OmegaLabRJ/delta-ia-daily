import { generateImage } from "@/lib/image-generation";

export async function executeGenerateImage(_professionalId: string, args: any) {
  const { technical_prompt, category, original_request } = args;

  if (!technical_prompt) {
    return { success: false, error: "Prompt técnico não fornecido." };
  }

  const result = await generateImage(technical_prompt, category);

  if (!result) {
    return {
      success: false,
      error:
        "A geração de imagem está demorando mais que o normal. O servidor de IA pode estar com muita demanda — tente novamente em alguns instantes! 🎨",
    };
  }

  return {
    success: true,
    action_type: "IMAGE_GENERATED",
    message: `Imagem criada com sucesso! 🎨`,
    imageUrl: result.url,
    originalRequest: original_request,
    source: result.source,
    alreadyUploaded: result.alreadyUploaded,
  };
}
