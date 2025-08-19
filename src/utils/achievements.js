// 成就系統管理工具
import { database, ref, set, get } from '../firebase';

// 成就定義
export const ACHIEVEMENTS = {
    MONTHLY_50: {
        id: 'monthly_50',
        name: '屎芭拉稀',
        description: '在一個月內達到50次，真的屎芭拉稀！！',
        icon: '🏆',
        target: 50,
        type: 'monthly_count'
    },
    // 可以在這裡添加更多成就
};

// 檢查月度成就
export async function checkMonthlyAchievement(userData, monthData) {
    if (!userData || !monthData) return null;

    const monthlyCount = monthData.count || 0;
    const achievement = ACHIEVEMENTS.MONTHLY_50;

    // 檢查用戶是否已經解鎖過這個成就
    const isAlreadyUnlocked = userData.achievements && userData.achievements[achievement.id] && userData.achievements[achievement.id].unlocked;

    return {
        ...achievement,
        progress: monthlyCount,
        unlocked: isAlreadyUnlocked || monthlyCount >= achievement.target,
        unlockDate: isAlreadyUnlocked ?
            userData.achievements[achievement.id].unlockDate :
            (monthlyCount >= achievement.target ? new Date().toISOString() : null)
    };
}

// 獲取用戶所有成就
export async function getUserAchievements(userData, monthData) {
    const achievements = [];

    // 檢查月度50次成就
    const monthly50 = await checkMonthlyAchievement(userData, monthData);
    if (monthly50) {
        achievements.push(monthly50);
    }

    return achievements;
}

// 檢查是否有新解鎖的成就
export async function checkNewAchievements(oldAchievements, newAchievements, userData, userName) {
    const newUnlocked = [];

    for (const newAchievement of newAchievements) {
        const oldAchievement = oldAchievements.find(a => a.id === newAchievement.id);

        if (newAchievement.unlocked && (!oldAchievement || !oldAchievement.unlocked)) {
            newUnlocked.push(newAchievement);
            // 保存新解鎖的成就到用戶資料中
            await saveUnlockedAchievement(newAchievement, userName);
        }
    }

    return newUnlocked;
}

// 保存已解鎖的成就到用戶資料中
async function saveUnlockedAchievement(achievement, userName) {
    try {
        // 獲取用戶當前資料
        const userRef = ref(database, `poopCounter/${userName}`);
        const userSnapshot = await get(userRef);
        const currentUserData = userSnapshot.val() || {};

        // 初始化成就對象（如果不存在）
        if (!currentUserData.achievements) {
            currentUserData.achievements = {};
        }

        // 保存成就狀態
        currentUserData.achievements[achievement.id] = {
            id: achievement.id,
            unlocked: true,
            unlockDate: achievement.unlockDate,
            timestamp: Date.now()
        };

        // 更新用戶資料
        await set(userRef, currentUserData);


    } catch (error) {

    }
}

// 初始化歷史成就 - 檢查所有用戶的歷史數據
export async function initializeHistoricalAchievements() {
    try {
        // 獲取所有歷史月份數據
        const historyRef = ref(database, 'monthlyHistory');
        const historySnapshot = await get(historyRef);
        const historyData = historySnapshot.val() || {};

        // 獲取當前月份數據
        const currentRef = ref(database, 'poopCounter');
        const currentSnapshot = await get(currentRef);
        const currentData = currentSnapshot.val() || {};

        // 合併所有用戶數據
        const allUsers = new Set();

        // 從歷史數據中收集用戶
        Object.values(historyData).forEach(monthData => {
            Object.keys(monthData).forEach(userName => {
                allUsers.add(userName);
            });
        });

        // 從當前數據中收集用戶
        Object.keys(currentData).forEach(userName => {
            allUsers.add(userName);
        });

        let unlockedCount = 0;

        // 檢查每個用戶的成就
        for (const userName of allUsers) {
            // 檢查當前月份
            let hasUnlocked = false;
            let unlockDate = null;

            if (currentData[userName]) {
                const currentCount = typeof currentData[userName] === 'number' ?
                    currentData[userName] : currentData[userName].count || 0;

                if (currentCount >= 50) {
                    hasUnlocked = true;
                    unlockDate = new Date().toISOString();
                }
            }

            // 檢查歷史月份
            if (!hasUnlocked) {
                for (const [month, monthData] of Object.entries(historyData)) {
                    if (monthData[userName]) {
                        const monthCount = typeof monthData[userName] === 'number' ?
                            monthData[userName] : monthData[userName].count || 0;

                        if (monthCount >= 50) {
                            hasUnlocked = true;
                            // 使用月份作為解鎖時間（如果沒有具體日期）
                            unlockDate = new Date(month + '-01').toISOString();
                            break;
                        }
                    }
                }
            }

            // 如果用戶曾經達到過50次，保存成就到用戶資料中
            if (hasUnlocked) {
                await saveUnlockedAchievement({
                    ...ACHIEVEMENTS.MONTHLY_50,
                    unlocked: true,
                    unlockDate: unlockDate
                }, userName);
                unlockedCount++;
            }
        }

        return unlockedCount;

    } catch (error) {
        return 0;
    }
}

// 成就解鎖通知（已禁用）
export function showAchievementNotification(achievement) {
    // 成就解鎖通知功能已禁用
    // 用戶仍然可以解鎖成就，但不會顯示彈窗通知
}

// 添加成就通知樣式（已禁用）
export function addAchievementNotificationStyles() {
    // 成就通知樣式功能已禁用
    // 不再需要添加通知相關的CSS樣式
}
