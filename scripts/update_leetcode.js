const fs = require('fs');
const path = require('path');

const USERNAME = 'carlsun-2'; // 你的力扣 ID

async function fetchStats() {
    const commonHeaders = {
        'Content-Type': 'application/json',
        'Referer': `https://leetcode.cn/u/${USERNAME}/`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Origin': 'https://leetcode.cn'
    };

    // 1. 获取核心统计数据 (AC 数)
    const statsQuery = {
        operationName: "userProblemsSolved",
        query: `
        query userProblemsSolved($username: String!) {
          allQuestionsCount { difficulty count }
          matchedUser(username: $username) {
            submitStatsGlobal {
              acSubmissionNum { difficulty count }
              totalSubmissionNum { difficulty count }
            }
          }
        }
      `,
        variables: { username: USERNAME }
    };

    // 2. 获取日历数据 (绿点图)
    const calendarQuery = {
        operationName: "userProfileCalendar",
        query: `
        query userProfileCalendar($username: String!) {
          matchedUser(username: $username) {
            userCalendar {
              submissionCalendar
            }
          }
        }
      `,
        variables: { username: USERNAME }
    };

    const [statsRes, calRes] = await Promise.all([
        fetch('https://leetcode.cn/graphql/', { method: 'POST', headers: commonHeaders, body: JSON.stringify(statsQuery) }),
        fetch('https://leetcode.cn/graphql/', { method: 'POST', headers: commonHeaders, body: JSON.stringify(calendarQuery) })
    ]);

    if (!statsRes.ok || !calRes.ok) {
        throw new Error(`API 请求失败: Stats(${statsRes.status}) Cal(${calRes.status})`);
    }

    const statsData = await statsRes.json();
    const calData = await calRes.json();

    if (statsData.errors || calData.errors) {
        throw new Error(`GraphQL 错误: ${JSON.stringify(statsData.errors || calData.errors)}`);
    }

    return {
        allQuestionsCount: statsData.data.allQuestionsCount,
        matchedUser: {
            ...statsData.data.matchedUser,
            userCalendar: calData.data.matchedUser.userCalendar
        }
    };
}

function generateSvg(data) {
    const user = data.matchedUser;
    const acStats = user.submitStatsGlobal.acSubmissionNum;
    const totalStats = user.submitStatsGlobal.totalSubmissionNum;
    const allCount = data.allQuestionsCount;

    const solved = acStats.find(i => i.difficulty === 'All').count;
    const totalSubs = totalStats.find(i => i.difficulty === 'All').count;
    const passRate = ((solved / totalSubs) * 100).toFixed(2);
    
    const calendarData = JSON.parse(user.userCalendar.submissionCalendar);
    
    let dotsSvg = "";
    const now = new Date();
    // 渲染最近一年的绿点
    for (let i = 0; i < 364; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (363 - i));
        const timestamp = Math.floor(d.setHours(0,0,0,0) / 1000).toString();
        const count = calendarData[timestamp] || 0;
        
        let color = "#333";
        if (count > 0) color = "#9be9a8";
        if (count > 2) color = "#40c463";
        if (count > 5) color = "#216e39";
        
        const x = Math.floor(i / 7) * 12;
        const y = (i % 7) * 12;
        dotsSvg += `<rect x="${x}" y="${y}" width="10" height="10" rx="2" fill="${color}" />`;
    }

    return `
    <svg width="450" height="360" viewBox="0 0 450 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="450" height="360" rx="16" fill="#1A1A1A"/>
      <text x="25" y="40" fill="#3B82F6" font-family="sans-serif" font-size="20" font-weight="bold">LeetCode Private Board</text>
      <text x="425" y="40" fill="#6B7280" font-family="sans-serif" font-size="14" text-anchor="end">@${USERNAME}</text>
      
      <g transform="translate(25, 70)">
        <text x="0" y="20" fill="#6B7280" font-size="14">Pass Rate</text>
        <text x="0" y="50" fill="white" font-size="24" font-weight="bold">${passRate}%</text>
        <text x="180" y="20" fill="#6B7280" font-size="14">Total Submissions</text>
        <text x="180" y="50" fill="white" font-size="24" font-weight="bold">${totalSubs}</text>
      </g>

      <g transform="translate(25, 150)">
        <rect width="400" height="80" rx="12" fill="#262626"/>
        <text x="20" y="30" fill="#4ADE80" font-size="12">Easy: ${acStats.find(i=>i.difficulty==='Easy').count}</text>
        <text x="150" y="30" fill="#FBBF24" font-size="12">Medium: ${acStats.find(i=>i.difficulty==='Medium').count}</text>
        <text x="280" y="30" fill="#F87171" font-size="12">Hard: ${acStats.find(i=>i.difficulty==='Hard').count}</text>
        <rect x="20" y="45" width="360" height="8" rx="4" fill="#333"/>
        <rect x="20" y="45" width="${(solved / allCount.find(i=>i.difficulty==='All').count) * 360}" height="8" rx="4" fill="#3B82F6"/>
      </g>

      <text x="25" y="255" fill="#6B7280" font-size="14">Submission Heatmap (Past Year)</text>
      <g transform="translate(25, 270)">
        ${dotsSvg}
      </g>
    </svg>
    `;
}

async function main() {
    try {
        console.log('Fetching data from LeetCode...');
        const data = await fetchStats();
        const svg = generateSvg(data);
        const outputPath = path.join(__dirname, '../static/images/leetcode-stats.svg');
        
        // 确保目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(outputPath, svg);
        console.log('Success! Saved to static/images/leetcode-stats.svg');
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();