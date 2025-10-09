import { supabase } from "./supabase";

export interface OpenAIReportResult {
  enneagram_type: string;
  characteristics: string;
  job_recommendations: string[];
  career_guidance?: string;
  growth_advice?: string;
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

    // 3. Load question data from Supabase
    const { data: preQuestions, error: preQError } = await supabase
      .from('pre_survey_questions')
      .select('*')
      .order('q_id');
    
    if (preQError) {
      console.error('Error loading pre-survey questions:', preQError);
      throw new Error('사전 설문 질문을 불러올 수 없습니다.');
    }

    const { data: mainQuestions, error: mainQError } = await supabase
      .from('main_survey_questions')
      .select('*')
      .order('q_id');
    
    if (mainQError) {
      console.error('Error loading main-survey questions:', mainQError);
      throw new Error('본 설문 질문을 불러올 수 없습니다.');
    }

    // 4. Format responses in Korean (same logic as admin detail view)
    const formattedPreSurvey = formatPreSurveyResponses(preAnswers, preQuestions || []);
    const formattedMainSurvey = formatMainSurveyResponses(mainAnswers, mainQuestions || []);

    // 5. Replace placeholders in prompt with actual formatted data
    let finalPromptContent = prompt.content;
    
    // Replace common placeholder patterns
    finalPromptContent = finalPromptContent
      .replace(/\{\{pre_survey_responses\}\}/g, formattedPreSurvey)
      .replace(/\{\{main_survey_responses\}\}/g, formattedMainSurvey)
      .replace(/\{\{사전_설문_응답\}\}/g, formattedPreSurvey)
      .replace(/\{\{본_설문_응답\}\}/g, formattedMainSurvey);

    // 6. Call OpenAI API with formatted prompt
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
            content: finalPromptContent
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API 호출 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('OpenAI API 응답이 비어있습니다.');
    }

    const aiResponse = data.choices[0].message.content;

    // 7. Parse AI response
    // Try to parse as JSON first
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          enneagram_type: parsed.enneagram_type || parsed.type || 'Unknown',
          characteristics: parsed.characteristics || parsed.특징 || aiResponse,
          job_recommendations: parsed.job_recommendations || parsed.직업추천 || [],
          career_guidance: parsed.career_guidance || parsed.진로조언 || undefined,
          growth_advice: parsed.growth_advice || parsed.성장조언 || undefined,
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

// Format pre-survey responses (same logic as admin detail view)
function formatPreSurveyResponses(answers: any[], questions: any[]): string {
  if (!questions || questions.length === 0) {
    return '사전 설문 질문 정보 없음';
  }

  return questions.map((q, idx) => {
    const answer = answers.find(a => String(a.q_id) === String(q.q_id));
    
    if (!answer) {
      return `Q${idx + 1}. ${q.text_ko || q.text || '질문 없음'}\n→ 미응답`;
    }

    // Parse options (handle both array and '/' separated string)
    let answerText = '';
    if (q.options) {
      let optionsArray: string[] = [];
      
      if (Array.isArray(q.options)) {
        optionsArray = q.options;
      } else if (typeof q.options === 'string') {
        optionsArray = q.options.split('/').map((opt: string) => opt.trim());
      }
      
      if (optionsArray.length > 0) {
        const idx = parseInt(String(answer.value)) - 1;
        answerText = optionsArray[idx] || `선택 ${answer.value}`;
      } else {
        answerText = String(answer.value);
      }
    } else {
      answerText = String(answer.value);
    }

    return `Q${idx + 1}. ${q.text_ko || q.text || '질문 없음'}\n→ ${answerText}`;
  }).join('\n\n');
}

// Format main-survey responses (Likert scale 1-6)
function formatMainSurveyResponses(answers: any[], questions: any[]): string {
  if (!questions || questions.length === 0) {
    return '본 설문 질문 정보 없음';
  }

  const likertLabels = [
    "전혀 그렇지 않다",
    "그렇지 않다",
    "약간 그렇지 않다",
    "약간 그렇다",
    "그렇다",
    "매우 그렇다"
  ];

  return questions.map((q, idx) => {
    const answer = answers.find(a => String(a.q_id) === String(q.q_id));
    
    if (!answer) {
      return `Q${idx + 1}. ${q.text_ko || q.text || '질문 없음'}\n→ 미응답`;
    }

    const value = parseInt(String(answer.value));
    const answerText = likertLabels[value - 1] || String(value);
    
    return `Q${idx + 1}. ${q.text_ko || q.text || '질문 없음'}\n→ ${value}점 (${answerText})`;
  }).join('\n\n');
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

