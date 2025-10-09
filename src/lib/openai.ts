import { supabase } from "./supabase";

export interface OpenAIReportResult {
  enneagram_type: string;
  characteristics: string;
  job_recommendations: string[];
}

export async function generateReportWithOpenAI(
  userId: string,
  preAnswers: any[],
  mainAnswers: any[]
): Promise<OpenAIReportResult> {
  try {
    // 1. Get API key and active prompt from Supabase
    const { data: settings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('openai_api_key, active_prompt_id')
      .eq('id', 1)
      .single();

    if (settingsError) throw settingsError;

    if (!settings.openai_api_key) {
      throw new Error('OpenAI API Key가 설정되지 않았습니다. 관리자 설정에서 API Key를 등록해주세요.');
    }

    if (!settings.active_prompt_id) {
      throw new Error('활성화된 프롬프트가 없습니다. 관리자 설정에서 프롬프트를 활성화해주세요.');
    }

    // 2. Get active prompt
    const { data: prompt, error: promptError } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('id', settings.active_prompt_id)
      .single();

    if (promptError) throw promptError;

    // 3. Format user responses for AI
    const formattedPreAnswers = preAnswers.map(a => ({
      question_id: a.q_id,
      answer: a.value
    }));

    const formattedMainAnswers = mainAnswers.map(a => ({
      question_id: a.q_id,
      answer: a.value
    }));

    const userResponseText = `
사용자 ID: ${userId}

[사전 설문 응답]
${JSON.stringify(formattedPreAnswers, null, 2)}

[본 설문 응답 (Likert 1-6 척도)]
${JSON.stringify(formattedMainAnswers, null, 2)}
`;

    console.log('Calling OpenAI API with prompt:', {
      promptTitle: prompt.title,
      preAnswersCount: preAnswers.length,
      mainAnswersCount: mainAnswers.length,
    });

    // 4. Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.openai_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // or 'gpt-4' if you have access
        messages: [
          {
            role: 'system',
            content: prompt.content
          },
          {
            role: 'user',
            content: userResponseText
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API 호출 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI API Response:', data);

    if (!data.choices || data.choices.length === 0) {
      throw new Error('OpenAI API 응답이 비어있습니다.');
    }

    const aiResponse = data.choices[0].message.content;
    console.log('AI Generated Response:', aiResponse);

    // 5. Parse AI response
    // Try to parse as JSON first
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          enneagram_type: parsed.enneagram_type || parsed.type || 'Unknown',
          characteristics: parsed.characteristics || parsed.특징 || aiResponse,
          job_recommendations: parsed.job_recommendations || parsed.직업추천 || []
        };
      }
    } catch (parseError) {
      console.warn('Failed to parse as JSON, using text extraction');
    }

    // Fallback: extract from text
    return extractReportFromText(aiResponse);
    
  } catch (error) {
    console.error('Error generating report with OpenAI:', error);
    throw error;
  }
}

function extractReportFromText(text: string): OpenAIReportResult {
  // Extract enneagram type
  const typeMatch = text.match(/(?:유형|type)[\s:：]*([0-9]번?\s*[\w가-힣]+)/i);
  const enneagram_type = typeMatch ? typeMatch[1] : 'Unknown';

  // Extract characteristics
  const charMatch = text.match(/(?:특징|characteristics)[\s:：]*([\s\S]+?)(?:직업|job|추천|$)/i);
  const characteristics = charMatch ? charMatch[1].trim() : text.substring(0, 200);

  // Extract job recommendations
  const jobMatches = text.match(/(?:직업|job)[\s\S]+?([가-힣\s,]+)/gi);
  const job_recommendations = jobMatches 
    ? jobMatches[0].split(/[,\n]/).filter(j => j.trim()).slice(0, 3).map(j => j.trim())
    : ['프로덕트 매니저', '데이터 분석가', 'UX 리서처'];

  return {
    enneagram_type,
    characteristics,
    job_recommendations,
  };
}

