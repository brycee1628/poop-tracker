<template>
    <div class="achievement-container" v-if="unlockedAchievements.length > 0">
        <h3 class="achievement-title">屎蹟</h3>
        <div class="achievement-grid">
            <div v-for="achievement in unlockedAchievements" :key="achievement.id" class="achievement-badge"
                @click="showAchievementDetails(achievement)" :title="`點擊查看 ${achievement.name} 詳情`">
                <div class="badge-icon">{{ achievement.icon }}</div>
                <div class="badge-name">{{ achievement.name }}</div>
            </div>
        </div>

        <!-- 成就詳情彈窗 -->
        <div v-if="showDetails" class="achievement-modal" @click="closeModal">
            <div class="modal-content" @click.stop>
                <div class="modal-header">
                    <h3>{{ selectedAchievement.icon }} {{ selectedAchievement.name }}</h3>
                    <button class="close-btn" @click="closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="achievement-description">{{ selectedAchievement.description }}</p>
                    <div class="achievement-info">
                        <p><strong>解鎖條件：</strong>{{ selectedAchievement.target }}次/月</p>
                        <p><strong>獲得時間：</strong>{{ formatDate(selectedAchievement.unlockDate) }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'Achievement',
    props: {
        achievements: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            showDetails: false,
            selectedAchievement: null
        };
    },
    computed: {
        unlockedAchievements() {
            return this.achievements.filter(achievement => achievement.unlocked);
        }
    },
    methods: {
        showAchievementDetails(achievement) {
            this.selectedAchievement = achievement;
            this.showDetails = true;
        },
        closeModal() {
            this.showDetails = false;
            this.selectedAchievement = null;
        },
        formatDate(dateString) {
            if (!dateString) return '未知';
            const date = new Date(dateString);
            return date.toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
};
</script>

<style scoped>
.achievement-container {
    margin-top: 20px;
    padding: 20px;
    background: linear-gradient(135deg, #fdfaf7, #f5f0e8);
    border-radius: 15px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
}

.achievement-title {
    text-align: center;
    margin-bottom: 20px;
    color: #4a3f35;
    font-size: 1.5em;
    font-weight: 600;
}

.achievement-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
    max-width: 400px;
    margin: 0 auto;
}

.achievement-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15px;
    background: linear-gradient(135deg, #ffd700, #ffed4e);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
    cursor: pointer;
    transition: all 0.3s ease;
    border: 3px solid #fff;
}

.achievement-badge:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(255, 215, 0, 0.4);
}

.badge-icon {
    font-size: 2.5rem;
    margin-bottom: 8px;
}

.badge-name {
    font-size: 0.9em;
    font-weight: 600;
    color: #333;
    text-align: center;
    line-height: 1.2;
}

/* 彈窗樣式 */
.achievement-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
}

.modal-content {
    background: white;
    border-radius: 15px;
    padding: 0;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-50px) scale(0.9);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.modal-header {
    background: linear-gradient(135deg, #ffd700, #ffed4e);
    padding: 20px;
    border-radius: 15px 15px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    color: #333;
    font-size: 1.3em;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.5em;
    color: #666;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
}

.close-btn:hover {
    background-color: rgba(0, 0, 0, 0.1);
}

.modal-body {
    padding: 25px;
}

.achievement-description {
    font-size: 1.1em;
    color: #555;
    margin-bottom: 20px;
    text-align: center;
    line-height: 1.5;
}

.achievement-info {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid #ffd700;
}

.achievement-info p {
    margin: 8px 0;
    color: #333;
    font-size: 0.95em;
}

.achievement-info strong {
    color: #4a3f35;
}

@media (max-width: 768px) {
    .achievement-grid {
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
    }

    .achievement-badge {
        padding: 12px;
    }

    .badge-icon {
        font-size: 2rem;
    }

    .badge-name {
        font-size: 0.8em;
    }
}
</style>
