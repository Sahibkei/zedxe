import { Inngest} from "inngest";

export const inngest = new Inngest({
    id: 'zedxe',
    ai: { chatgpt: { apikey: process.env.OPENAI_API_KEY }}
})