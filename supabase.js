// Supabase API 키 및 URL 상수
const SUPABASE_URL = "https://dfomeijvzayyszisqflo.supabase.co";
const SUPABASE_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmb21laWp2emF5eXN6aXNxZmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDg2NjA0MiwiZXhwIjoyMDYwNDQyMDQyfQ.K4VKm-nYlbODIEvO9P6vfKsvhLGQkY3Kgs-Fx36Ir-4"
//service rollkey사용해야함

function initSupabase() {
  // 이미 생성되어 있으면 재사용
  if (!window.supabase || !window.supabase.from) {
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase 클라이언트가 새로 생성되었습니다.");
  } else {
    console.log("🔄 Supabase 클라이언트를 재사용합니다.");
  }
  return window.supabase;
}
// 사용하려는 위치에서 ↓ 이렇게 두 줄
const supabase = initSupabase(); // 1. 클라이언트 가져오기

// 직원 정보를 가져오는 함수
async function getEmployeesInfo() {
  try {
    const { data, error } = await supabase
      .from('employeesinfo')
      .select('직원번호, 직원명');
    
    if (error) {
      console.error('직원 정보 로드 에러:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('직원 정보 로드 중 예외 발생:', error);
    return [];
  }
}