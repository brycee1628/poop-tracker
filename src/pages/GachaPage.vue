<template>
    <div class="gacha-container">
        <h1 class="gacha-title">💩純白聖域💩</h1>
        <p class="subtitle">每一筆屎蹟，都有屬於它的意義。</p>
        <p class="description">
            慶祝開幕，本池笑話限時up中。
        </p>
        
        <div class="toilet-gacha">
        <!-- 沖水按鈕 -->
        <div class="flush-button-area">
            <div 
            class="flush-button" 
            @click="pullGacha" 
            :class="{ 'pressed': isButtonPressed, 'disabled': isAnimating }">
            </div>
        </div>
        
        <div class="toilet-top" @click="toggleLid">
            <div class="toilet-lid" :class="{ 'open': isLidOpen }"></div>
            <div class="toilet-lid-cover" v-if="!isLidOpen"></div>
            <div class="toilet-seat" :class="{ 'open': isLidOpen }"></div>
        </div>
        
        <div class="toilet-bowl">
            <div class="toilet-water" :class="{ 'flushing': isFlushing }">
            <!-- 漂浮的便便 -->
            <div v-if="!isFlushing" class="floating-poops">
                <div class="poop poop-1 poop-brown">
                <div class="poop-face">
                    <div class="poop-eyes"></div>
                    <div class="poop-mouth"></div>
                </div>
                </div>
                <div class="poop poop-2 poop-green">
                <div class="poop-face">
                    <div class="poop-eyes"></div>
                    <div class="poop-mouth smile"></div>
                </div>
                </div>
                <div class="poop poop-3 poop-golden">
                <div class="poop-face">
                    <div class="poop-eyes happy"></div>
                    <div class="poop-mouth big-smile"></div>
                </div>
                </div>
            </div>
            
            <div v-if="isFlushing" class="water-swirl"></div>
            
            <!-- 水花四濺效果 -->
            <div v-if="isFlushing" class="flush-bubbles">
                <div 
                class="bubble" 
                v-for="i in 20" 
                :key="i" 
                :style="getBubbleStyle(i)">
                </div>
            </div>
            </div>
        </div>
        
        <div class="toilet-base">
            <!-- 底座出口 -->
            <div class="prize-outlet">
            <div 
                v-if="showPrizeOutlet" 
                class="prize-capsule" 
                :class="{'prize-appeared': prizeAppeared}">
                <div class="capsule-top"></div>
                <div class="capsule-bottom"></div>
            </div>
            </div>
        </div>
        </div>

        <!-- 獎品顯示區 -->
        <div 
        class="prize-display" 
        v-if="currentPrize && prizeAppeared" 
        :class="'rarity-' + currentPrize.rarity">
        <div class="prize-content">
            <div class="prize-name">{{ currentPrize.name }}</div>
            <div 
            class="prize-rarity" 
            :class="'rarity-' + currentPrize.rarity">
            {{ getPrizeRarityText(currentPrize.rarity) }}
            </div>
        </div>
        </div>

        <div v-if="gachaMessage" class="gacha-message">
        {{ gachaMessage }}
        </div>

        <div class="prize-history">
        <h2>獎品紀錄</h2>
        <ul>
            <li v-for="(prize, index) in prizeHistory" :key="index">
            {{ prize.name }}
            </li>
        </ul>
        </div>
    </div>
</template>

<script>
    export default {
    name: "GachaPage",
    data() {
        return {
        isLidOpen: false,
        isAnimating: false,
        isFlushing: false,
        isButtonPressed: false,
        showPrizeOutlet: false,
        prizeAppeared: false,
        currentPrize: null,
        gachaMessage: "",
        prizeHistory: [],
        prizes: [
            { id: 1, name: "「醫生說我的笑點太低，需要拉高一點。我說：太好了，這就是我要的高度治療！」", rarity: "common", chance: 0.04 },
            { id: 2, name: "「為什麼馬桶蓋總是抱怨？因為大家老是對它發脾氣！」", rarity: "common", chance: 0.04 },
            { id: 3, name: "「我昨天吃了個時鐘，現在肚子裡時間過得特別慢。」", rarity: "common", chance: 0.04 },
            { id: 4, name: "「廁所笑話雖然很臭，但總是能讓人忍不住噗嗤一笑。」", rarity: "common", chance: 0.04 },
            { id: 5, name: "「廚師問我喜歡吃什麼？我說我喜歡我媽做的飯菜。於是廚師就把我媽請到廚房去了...」", rarity: "common", chance: 0.03 },
            { id: 6, name: "「我不是在廁所玩手機，我是在手機上廁所。」", rarity: "common", chance: 0.03 },
            { id: 7, name: "「坐在馬桶上的心態：不出來不罷休。」", rarity: "common", chance: 0.03 },
            { id: 8, name: "「小時候，我以為馬桶吃了我們的便便，長大後才知道，它只是幫我們傳遞給更大的馬桶。」", rarity: "common", chance: 0.025 },
            { id: 9, name: "「在廁所滑手機太久，屁股上的紅印不是紅暈，而是印堂。」", rarity: "common", chance: 0.025 },
            { id: 10, name: "「媽媽問孩子：知道為什麼大便後要洗手嗎？孩子說：因為我是用手擦的啊！」", rarity: "uncommon", chance: 0.02 },
            { id: 11, name: "「我的便秘問題太嚴重了，連看恐怖片都嚇不出來。」", rarity: "uncommon", chance: 0.02 },
            { id: 12, name: "「我告訴醫生我總是夢見自己是一個馬桶，他說：『這很正常，你只是排解壓力的方式比較特別。』」", rarity: "uncommon", chance: 0.02 },
            { id: 13, name: "「有個人走進廁所發現沒紙了，他說：『今天的情況不妙啊！』」", rarity: "uncommon", chance: 0.02 },
            { id: 14, name: "「我寫了一本《廁所禮儀指南》，結果全被用完了。」", rarity: "uncommon", chance: 0.015 },
            { id: 15, name: "「同事問我：你為什麼老是帶著筆記本去廁所？我說：因為好點子總是在那裡湧現。」", rarity: "uncommon", chance: 0.015 },
            { id: 16, name: "「為什麼鬼不用上廁所？因為它們已經嚇出來了！」", rarity: "rare", chance: 0.015 },
            { id: 17, name: "「我的減肥計劃很簡單：每吃一頓，就去廁所照鏡子。」", rarity: "rare", chance: 0.015 },
            { id: 18, name: "「廁所是世界上最誠實的地方，因為每個人都在那裡卸下防備。」", rarity: "rare", chance: 0.01 },
            { id: 19, name: "「我有個超能力，就是每次進廁所都能讓室友突然想上廁所。」", rarity: "rare", chance: 0.01 },
            { id: 20, name: "「去朋友家做客不小心把他家馬桶堵了，我只好打電話叫搬家公司。」", rarity: "rare", chance: 0.01 },
            { id: 21, name: "「為什麼人在緊張時總會想上廁所？因為屎怕人。」", rarity: "rare", chance: 0.01 },
            { id: 22, name: "「如果笑是最好的藥，那廁所就是全球最大的藥局。」", rarity: "ultra-rare", chance: 0.008 },
            { id: 23, name: "「昨天坐在馬桶上想了個絕妙的笑話，可惜一沖水就忘了。」", rarity: "ultra-rare", chance: 0.005 },
            { id: 24, name: "「馬桶說：『我的人生雖然充滿了屎，但我依然堅持把一切都沖走。』這就是正能量！」", rarity: "ultra-rare", chance: 0.005 },
            { id: 25, name: "「人生就像上廁所，有時候覺得沒東西了，一使勁，發現還有。」", rarity: "ultra-rare", chance: 0.003 },
            { id: 26, name: "「我認為馬桶是世界上最偉大的發明，因為它讓我們可以心安理得地把事情都沖走，然後重新開始。」", rarity: "ultra-rare", chance: 0.003 },
            
            // 新增一般生活笑話
            { id: 27, name: "「我問醫生：『我還能活多久？』醫生說：『十...』我緊張地問：『十什麼？十年？十個月？』醫生說：『九、八、七...』」", rarity: "common", chance: 0.04 },
            { id: 28, name: "「我媽說我像Google，因為我好像什麼都知道。其實我只是很會裝懂罷了。」", rarity: "common", chance: 0.04 },
            { id: 29, name: "「老師：為什麼你的作業上有你爸爸的筆跡？學生：因為我用他的筆寫的。」", rarity: "common", chance: 0.04 },
            { id: 30, name: "「剛搬進新房子，接到一個陌生來電：『你家的狗今天又在我家門口大便！』我說：『對不起，我沒養狗。』對方說：『喔不好意思，那應該是你。』」", rarity: "common", chance: 0.03 },
            { id: 31, name: "「醫生說我的幽默感有問題，我笑著問這是不是個笑話。」", rarity: "common", chance: 0.03 },
            { id: 32, name: "「今天我把口罩戴反了，嘴巴貼在鼻子上，鼻子露在外面。沒錯，我就是那個為了防疫把腦子戴在頭上的人。」", rarity: "common", chance: 0.03 },
            { id: 33, name: "「老婆生氣地問我：『你是不是又忘了我們的結婚紀念日？』我淡定地回答：『當然沒有，不過我決定以後隔幾天才慶祝，免得太容易被你猜到。』」", rarity: "uncommon", chance: 0.02 },
            { id: 34, name: "「醫生說我應該多運動，於是我開始每天爬樓梯。但住一樓的我只好反覆進出電梯，向上爬一層再搭電梯下來。」", rarity: "uncommon", chance: 0.02 },
            { id: 35, name: "「我的存款就像洋蔥，每次看都讓我哭。」", rarity: "uncommon", chance: 0.02 },
            { id: 36, name: "「同事問我週末有什麼計劃，我說：『當然是充分利用時間，好好發展自己啊！』同事一臉欽佩。其實我的計劃是充分利用躺平的時間，好好發展我的肚子。」", rarity: "uncommon", chance: 0.02 },
            { id: 37, name: "「同事：我女朋友說我不夠專一，我想分手。我：為什麼？同事：因為我只有一個女朋友。」", rarity: "uncommon", chance: 0.015 },
            { id: 38, name: "「面試官：你的優點是什麼？我：我非常誠實。面試官：那你的缺點呢？我：我不在乎別人的感受。面試官：我覺得這樣可能不太好... 我：我不在乎你怎麼想。」", rarity: "uncommon", chance: 0.015 },
            { id: 39, name: "「聽說有人因為經常熬夜加班，被診斷為職業病，醫生開了一張假條，上面寫著：建議辭職。」", rarity: "rare", chance: 0.015 },
            { id: 40, name: "「大學教授：『這個問題太簡單了，連一年級學生都會。』學生：『所以我們都不會是正常的，對吧？』」", rarity: "rare", chance: 0.015 },
            { id: 41, name: "「我懷疑健身房老闆是個騙子，都半年了，他答應的馬甲線還沒有送來。」", rarity: "rare", chance: 0.01 },
            { id: 42, name: "「我失眠時會數羊，數到第21只時發現少了一隻，然後我整晚都在找那隻丟失的羊。」", rarity: "rare", chance: 0.01 },
            { id: 43, name: "「如果蝴蝶效應是真的，那我剛剛不小心踩死的那隻蟑螂原本會不會是引發第三次世界大戰的關鍵？真是幸好我踩死了它。」", rarity: "rare", chance: 0.01 },
            { id: 44, name: "「我的工作是專業問題解決專家。基本上就是Google搜尋的人形界面。」", rarity: "rare", chance: 0.01 },
            { id: 45, name: "「考試時老師說：『時間有限，請把答案寫在答題卡上就好。』於是我寫道：『答案都在我腦子裡。』可惜我得了零分，老師評語：『但我看不見你的腦子。』」", rarity: "ultra-rare", chance: 0.008 },
            { id: 46, name: "「有人問愛因斯坦：『請問您知道聲音的速度是多少嗎？』愛因斯坦說：『我不知道，但我知道人類八卦的速度比光速還快。』」", rarity: "ultra-rare", chance: 0.005 },
            { id: 47, name: "「如果生活給了你檸檬，但你不喜歡檸檬水怎麼辦？把檸檬還給生活，然後大聲喊：『我要西瓜！』」", rarity: "ultra-rare", chance: 0.005 },
            { id: 48, name: "「人生就像穿襪子，有時候你以為穿好了，走著走著才發現有個洞；有時候你以為有個洞，低頭一看發現只是腳趾頭。」", rarity: "ultra-rare", chance: 0.003 },
            { id: 49, name: "「我離婚不是因為我們的差異，而是因為相似——我們都愛上了同一個人：她的閨蜜。」", rarity: "ultra-rare", chance: 0.003 },
            { id: 50, name: "「經濟學家說：『想要存錢，最好的方法就是把錢存起來。』我認為這是廢話，但又無法反駁。」", rarity: "ultra-rare", chance: 0.003 },
            
            // 新增更多笑話 1-10
            { id: 51, name: "「廁所沒紙了，但我發現了一本字典。現在我的詞彙量豐富多了。」", rarity: "common", chance: 0.04 },
            { id: 52, name: "「馬桶告訴我：『你的人生跟我一樣，總是被人坐著。』」", rarity: "common", chance: 0.04 },
            { id: 53, name: "「我每天早上第一件事就是去廁所，不知道是起床習慣還是排便習慣。」", rarity: "common", chance: 0.04 },
            { id: 54, name: "「有人說我總是在廁所冥想，其實我只是在努力排便。」", rarity: "common", chance: 0.035 },
            { id: 55, name: "「醫生告訴我多吃蔬菜對身體好，現在我的廁所時間延長了一倍。」", rarity: "common", chance: 0.035 },
            { id: 56, name: "「我的廁所是家裡唯一不會被打擾的地方，直到我老婆發現我在裡面玩手機。」", rarity: "uncommon", chance: 0.02 },
            { id: 57, name: "「為什麼便秘的人都很有耐心？因為他們習慣了等待。」", rarity: "uncommon", chance: 0.02 },
            { id: 58, name: "「同事問我為什麼每天帶書去廁所，我說：『因為我想把知識吸收得更徹底。』」", rarity: "rare", chance: 0.01 },
            { id: 59, name: "「我從不在馬桶上看恐怖片，因為嚇出來的東西可能會讓我後悔。」", rarity: "rare", chance: 0.01 },
            { id: 60, name: "「想到我們每天坐的馬桶比辦公椅還乾淨，就覺得人生充滿諷刺。」", rarity: "ultra-rare", chance: 0.005 },
            
            // 新增更多笑話 11-20
            { id: 61, name: "「我室友說他廁所裡有鬼，每次都嚇得他拉得特別快。」", rarity: "common", chance: 0.035 },
            { id: 62, name: "「廁所門上寫著：『暫停使用』，我心想：這不是屎點要來的時候嗎？」", rarity: "common", chance: 0.035 },
            { id: 63, name: "「我把最好的想法都留在了廁所，因為沖水後就再也想不起來了。」", rarity: "common", chance: 0.035 },
            { id: 64, name: "「聽說馬桶是最乾淨的地方之一，但我還是不願意在上面吃飯。」", rarity: "common", chance: 0.035 },
            { id: 65, name: "「電影院的廁所總是在關鍵時刻讓我選擇：到底是劇情重要還是膀胱重要？」", rarity: "uncommon", chance: 0.02 },
            { id: 66, name: "「廁所文學是我每天必修的學分，手機電量見證了我的勤奮。」", rarity: "uncommon", chance: 0.02 },
            { id: 67, name: "「世界上最遙遠的距離，不是生與死，而是急需上廁所時，廁所卻在裝修。」", rarity: "rare", chance: 0.01 },
            { id: 68, name: "「馬桶告訴我，它見過太多的大風大浪，但從不抱怨，只是默默承受一切。」", rarity: "rare", chance: 0.01 },
            { id: 69, name: "「如果你覺得人生艱難，想想馬桶，它每天都在接受別人的糞便，卻依然保持微笑。」", rarity: "ultra-rare", chance: 0.005 },
            { id: 70, name: "「馬桶對我說：『你知道嗎？每個人在我面前都是平等的。』」", rarity: "ultra-rare", chance: 0.005 },
            
            // 新增更多元的笑話 21-30
            { id: 71, name: "「我的鄰居說他是健身教練，但我發現他從來不做蹲下的動作，只是蹲馬桶。」", rarity: "common", chance: 0.035 },
            { id: 72, name: "「我在森林裡迷路了，GPS告訴我：『你已經抵達目的地。』但我只是想找個廁所。」", rarity: "common", chance: 0.035 },
            { id: 73, name: "「我的程式設計老師告訴我：『生活就像程式，總是會有Bug。』我想這就是為什麼我的生活總是當機。」", rarity: "common", chance: 0.035 },
            { id: 74, name: "「餐廳服務員問客人：『您的牛排要幾分熟？』客人說：『要及格就好。』」", rarity: "common", chance: 0.035 },
            { id: 75, name: "「老師問：『誰能告訴我什麼是熱脹冷縮？』學生回答：『夏天的時候假期變長，冬天的時候假期縮短。』」", rarity: "uncommon", chance: 0.02 },
            { id: 76, name: "「我問心理醫生我為什麼總是感到孤獨，他給了我一張名片，上面寫著：『你不是一個人，我也很寂寞。』」", rarity: "uncommon", chance: 0.02 },
            { id: 77, name: "「我的老闆說我總是遲到，我說那是因為我認為準時是一種浪費，提早到的人都在等待。」", rarity: "rare", chance: 0.01 },
            { id: 78, name: "「老師問小明：『你為什麼作業上寫著「爸爸監督」？』小明說：『因為是爸爸寫的。』」", rarity: "rare", chance: 0.01 },
            { id: 79, name: "「我問我的智能手機：『我美嗎？』它說：『對不起，我無法解析您的照片，這可能是系統限制。』」", rarity: "ultra-rare", chance: 0.005 },
            { id: 80, name: "「一個數學家走進酒吧，點了0.9999...杯啤酒。酒保給了他1杯。數學家說：『謝謝，這就是我想要的。』」", rarity: "ultra-rare", chance: 0.005 },
            
            // 新增更多元的笑話 31-40
            { id: 81, name: "「為什麼鯊魚不吃律師？職業道德。」", rarity: "common", chance: 0.03 },
            { id: 82, name: "「我的上司告訴我：『你的工作表現就像鹽巴，不加就覺得不好吃，加太多又會送醫院。』」", rarity: "common", chance: 0.03 },
            { id: 83, name: "「警察問小偷：『你為什麼只偷超市裡的番茄醬？』小偷回答：『因為我在找人生的方向。』」", rarity: "common", chance: 0.03 },
            { id: 84, name: "「蛋糕對餅乾說：『你太碎了！』餅乾回答：『我只是有點壓力而已。』」", rarity: "common", chance: 0.03 },
            { id: 85, name: "「我的枕頭曾經告訴我：『早上好難受，你總是流口水。』」", rarity: "uncommon", chance: 0.02 },
            { id: 86, name: "「面試官：『你未來五年的計劃是什麼？』我：『不知道，我連今天晚餐吃什麼都還沒決定。』」", rarity: "uncommon", chance: 0.02 },
            { id: 87, name: "「科學家說人類只用了腦容量的10%，那麼剩下的90%在幹嘛？可能在想晚餐吃什麼。」", rarity: "rare", chance: 0.01 },
            { id: 88, name: "「我的電腦告訴我：『我不是故意當機的，只是有時候你的操作讓我難以理解。』」", rarity: "rare", chance: 0.01 },
            { id: 89, name: "「有人問我：『你為什麼總是心不在焉？』我說：『抱歉，你說什麼？』」", rarity: "ultra-rare", chance: 0.005 },
            { id: 90, name: "「為什麼音樂家不擅長開玩笑？因為他們總是把事情搞得很有節奏感，卻少了笑點。」", rarity: "ultra-rare", chance: 0.005 },
            
            // 新增最後一批笑話 41-50
            { id: 91, name: "「為什麼書不喜歡被人翻閱？因為每次都要被迫露出內心深處。」", rarity: "common", chance: 0.03 },
            { id: 92, name: "「我的室友告訴我：『你睡覺打呼聲太大了！』我說：『那是我在練習讓自己不會寂寞。』」", rarity: "common", chance: 0.03 },
            { id: 93, name: "「為什麼鳥不用上廁所？因為牠們隨時隨地都在放飛自我。」", rarity: "common", chance: 0.03 },
            { id: 94, name: "「我媽對我說：『別人家的孩子都當了CEO。』我說：『那是因為他爸是董事長。』」", rarity: "common", chance: 0.03 },
            { id: 95, name: "「為什麼大學生總是缺錢？因為知識是無價的，學費卻不是。」", rarity: "uncommon", chance: 0.02 },
            { id: 96, name: "「我的筆記本電腦告訴我：『你工作效率太低了，都不如我發熱的速度快。』」", rarity: "uncommon", chance: 0.02 },
            { id: 97, name: "「我的咖啡說：『沒有我，你根本撐不過早上九點。』我不得不承認這是事實。」", rarity: "rare", chance: 0.01 },
            { id: 98, name: "「有時候我懷疑我是不是世界上最懶的人，但我連想這個問題都覺得太累了。」", rarity: "rare", chance: 0.01 },
            { id: 99, name: "「我的鬧鐘每天都提醒我：『醒醒吧，現實比你的夢還精彩！』但它從來沒說過現實有多慘。」", rarity: "ultra-rare", chance: 0.005 },
            { id: 100, name: "「宇宙告訴我：『你很渺小，但你的煩惱卻很巨大。』」", rarity: "ultra-rare", chance: 0.003 },
        ],
        flushingSounds: [
            new Audio("https://www.soundjay.com/mechanical/sounds/toilet-flush-1.mp3")
        ]
        };
    },
    methods: {
        toggleLid() {
        if (!this.isAnimating) {
            this.isLidOpen = !this.isLidOpen;
        }
        },
        
        pullGacha() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.showPrizeOutlet = false;
        this.prizeAppeared = false;
        this.currentPrize = null;
        this.isButtonPressed = true;
        
        // 確保馬桶蓋是打開的
        if (!this.isLidOpen) {
            this.isLidOpen = true;
            setTimeout(() => this.startFlushingAnimation(), 500);
        } else {
            this.startFlushingAnimation();
        }
        },
        
        startFlushingAnimation() {
        this.gachaMessage = "正在沖水...";
        this.isFlushing = true;
        
        // 播放沖水音效
        try {
            const sound = this.flushingSounds[0];
            sound.currentTime = 0;
            sound.play();
        } catch (error) {
            console.log("無法播放音效", error);
        }
        
        // 在1秒後恢復按鈕狀態
        setTimeout(() => {
            this.isButtonPressed = false;
        }, 1000);
        
        // 抽獎邏輯
        const prize = this.getRandomPrize();
        
        // 沖水動畫 - 增加前進後縮的聲效視覺配合
        setTimeout(() => {
            // 第一階段結束
        
            // 沖水動畫持續
            setTimeout(() => {
            this.isFlushing = false;
            this.gachaMessage = "獎品正在出來...";
            
            // 獎品從底座出來動畫
            setTimeout(() => {
                this.currentPrize = prize;
                this.showPrizeOutlet = true;
                
                setTimeout(() => {
                this.prizeAppeared = true;
                this.prizeHistory.unshift(prize);
                this.gachaMessage = `恭喜獲得：${prize.name}！`;
                
                // 結束動畫
                setTimeout(() => {
                    this.isLidOpen = false;
                    this.isAnimating = false;
                }, 3000);
                }, 500);
            }, 1000);
            }, 3000);
        }, 500);
        },
        
        getRandomPrize() {
        const random = Math.random();
        let probabilitySum = 0;
        
        for (const prize of this.prizes) {
            probabilitySum += prize.chance;
            if (random <= probabilitySum) {
            return prize;
            }
        }
        
        // 萬一機率算錯，返回第一個獎品
        return this.prizes[0];
        },
        
        getPrizeRarityText(rarity) {
        const rarityMap = {
            'common': '普通',
            'uncommon': '少見',
            'rare': '稀有',
            'ultra-rare': '超級稀有'
        };
        return rarityMap[rarity] || '';
        },
        
        getBubbleStyle(index) {
        // 隨機生成氣泡位置和大小
        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * 60;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        const size = 5 + Math.random() * 15;
        const delay = Math.random() * 0.5;
        
        return {
            '--tx': `${tx}px`,
            '--ty': `${ty}px`,
            '--s': Math.random() * 0.5 + 0.5,
            width: `${size}px`,
            height: `${size}px`,
            left: `${50 - size/2}%`,
            top: `${50 - size/2}%`,
            animationDelay: `${delay}s`
        };
        }
    }
    };
</script>

<style scoped>
/* 基本容器樣式 */
.gacha-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.gacha-title {
  font-size: 28px;
  margin-bottom: 15px;
  color: var(--black);
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 1.2em;
  color: #666;
  margin-bottom: 20px;
  font-style: italic;
}

.description {
  font-size: 1.1em;
  line-height: 1.8;
  color: #4a3f35;
  background-color: #fdfaf7;
  padding: 20px;
  border-left: 4px solid #d6c2a1;
  border-radius: 8px;
  max-width: 600px;
  margin: 0 auto 30px auto;
  font-family: 'Georgia', serif;
  text-align: center;
}

/* 馬桶主體 */
.toilet-gacha {
  position: relative;
  width: 200px;
  margin-bottom: 15px;
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.15));
  transition: transform 0.3s ease;
}

.toilet-gacha:hover {
  transform: translateY(-3px);
}

.toilet-top {
  position: relative;
  width: 180px;
  margin: 0 auto;
  cursor: pointer;
  z-index: 10;
  transition: filter 0.3s ease;
}

.toilet-top:hover {
  filter: brightness(1.05);
}

.toilet-lid {
  position: absolute;
  top: 0;
  width: 180px;
  height: 20px;
  background-color: white;
  border-radius: 10px 10px 0 0;
  border: 2px solid #ddd;
  transition: transform 0.5s;
  transform-origin: center top;
  z-index: 12;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.toilet-lid.open {
  transform: rotateX(-110deg);
}

.toilet-seat {
  position: absolute;
  top: 5px;
  width: 160px;
  height: 20px;
  left: 10px;
  background-color: #f8f8f8;
  border-radius: 10px 10px 0 0;
  border: 2px solid #ddd;
  transition: transform 0.4s 0.1s;
  transform-origin: center top;
  z-index: 11;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.08);
}

.toilet-seat.open {
  transform: rotateX(-100deg);
}

.toilet-lid-cover {
  position: absolute;
  top: 20px;
  left: 0;
  width: 180px;
  height: 125px;
  background: linear-gradient(to bottom, white, #f8f8f8);
  border-radius: 0 0 50px 50px;
  border: 2px solid #ddd;
  border-top: none;
  z-index: 9;
  transform-origin: top center;
  transition: transform 0.5s;
  box-sizing: border-box;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
}

.toilet-lid.open + .toilet-lid-cover {
  transform: rotateX(-110deg);
  visibility: hidden;
}

.toilet-bowl {
  width: 160px;
  height: 120px;
  margin: 0 auto;
  background: linear-gradient(to bottom, white, #f5f5f5);
  border-radius: 0 0 50px 50px;
  border: 2px solid #ddd;
  position: relative;
  overflow: hidden;
  z-index: 5;
  margin-top: 10px;
  box-shadow: inset 0 -5px 15px rgba(0, 0, 0, 0.08);
}

/* 馬桶水效果 */
.toilet-water {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 80px;
  background: linear-gradient(to bottom, #c2e8ff 0%, #a0d8ff 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.3s;
  overflow: hidden;
  box-shadow: inset 0 0 15px rgba(255, 255, 255, 0.5);
}

.toilet-water::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 15px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0));
  border-radius: 50%;
  transform: scaleX(1.5);
}

.toilet-water.flushing {
  background: linear-gradient(to bottom, #89d2f5 0%, #47a4e3 100%);
  animation: water-turbulence 3s forwards;
}

@keyframes water-turbulence {
  0% { 
    background-color: #89d2f5; 
    transform: translateY(0);
  }
  15% { 
    background-color: #3d9be0; 
    transform: translateY(-5px) scale(1.05);
  }
  30% { 
    background-color: #3d9be0; 
    transform: translateY(0);
  }
  50% { 
    background-color: #1a85d9; 
    transform: translateY(-8px) scale(1.08);
  }
  75% { 
    background-color: #3d9be0; 
    transform: translateY(0);
  }
  100% { 
    background-color: #c2e8ff; 
    transform: translateY(0);
  }
}

.water-swirl {
  width: 80px;
  height: 80px;
  background: conic-gradient(#3d9be0, #89d2f5, #c2e8ff, #3d9be0);
  border-radius: 50%;
  position: relative;
  animation: rotate 1s linear infinite, shrink 3s forwards;
  box-shadow: 0 0 20px 5px rgba(61, 155, 224, 0.5);
}

.water-swirl::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: #1a85d9;
  border-radius: 50%;
  opacity: 0.7;
  animation: pulse 1s ease-in-out infinite;
}

.water-swirl::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  border: 2px solid #89d2f5;
  opacity: 0.8;
  animation: expand 2s ease-out infinite;
}

@keyframes rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes shrink {
  0% { transform: scale(1) rotate(0deg); opacity: 1; }
  50% { transform: scale(0.8) rotate(180deg); opacity: 0.8; }
  90% { transform: scale(0.3) rotate(320deg); opacity: 0.5; }
  100% { transform: scale(0) rotate(360deg); opacity: 0; }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.2); opacity: 0.9; }
}

@keyframes expand {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.3); opacity: 0; }
}

/* 水花四濺效果 */
.flush-bubbles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.bubble {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  pointer-events: none;
  animation: bubble-float 2s ease-out forwards;
  box-shadow: inset 0 0 3px rgba(255, 255, 255, 0.5);
}

@keyframes bubble-float {
  0% { 
    transform: translate(0, 0) scale(0);
    opacity: 0.8; 
  }
  100% { 
    transform: translate(var(--tx), var(--ty)) scale(var(--s));
    opacity: 0; 
  }
}

/* 馬桶底座 */
.toilet-base {
  width: 120px;
  height: 80px;
  margin: 0 auto;
  background: linear-gradient(to bottom, white, #f5f5f5);
  border: 2px solid #ddd;
  position: relative;
  overflow: visible;
  border-radius: 0 0 10px 10px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

/* 底座出口樣式 */
.prize-outlet {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 15px;
  background-color: #eee;
  border-radius: 20px 20px 0 0;
  overflow: hidden;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.1);
}

/* 扭蛋膠囊 */
.prize-capsule {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  height: 40px;
  transition: transform 1s ease-out;
  transform: translateY(0%);
  filter: drop-shadow(0 5px 10px rgba(0,0,0,0.2));
}

.prize-appeared {
  transform: translateY(-100%);
}

.capsule-top {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background: linear-gradient(to bottom, #FFC107, #FFB300);
  border-radius: 20px 20px 0 0;
  border: 1px solid rgba(0,0,0,0.1);
  border-bottom: none;
}

.capsule-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background: linear-gradient(to bottom, #FFEB3B, #FDD835);
  border-radius: 0 0 20px 20px;
  border: 1px solid rgba(0,0,0,0.1);
  border-top: none;
}

/* 馬桶把手樣式 */
.flush-button-area {
  position: absolute;
  left: 60px;
  top: 160px;
  z-index: 15;
}

.flush-button {
  width: 60px;
  height: 25px;
  background: linear-gradient(to bottom, #e8e8e8, #c0c0c0);
  border-radius: 12px;
  border: 1px solid #aaa;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  position: relative;
  transform-origin: left center;
  transition: transform 0.3s;
  transform: rotate(180deg);
}

.flush-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f5f5f5, #d0d0d0);
  border: 1px solid #aaa;
  box-sizing: border-box;
}

.flush-button::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 10px;
  left: 25px;
  height: 8px;
  transform: translateY(-50%);
  background: linear-gradient(to bottom, #d8d8d8, #b8b8b8);
  border-radius: 4px;
  border-top: 1px solid #ccc;
  border-bottom: 1px solid #999;
}

.flush-button:hover {
  background: linear-gradient(to bottom, #f0f0f0, #d0d0d0);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.flush-button.pressed {
  transform: rotate(150deg);
  transition: transform 0.3s ease-out;
}

.flush-button.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 漂浮的便便樣式 */
.floating-poops {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.poop {
  position: absolute;
  border-radius: 50% 50% 50% 50%;
  z-index: 1;
  box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.2);
}

.poop-brown {
  background: linear-gradient(to bottom, #9b7653, #7d5d3b);
}

.poop-green {
  background: linear-gradient(to bottom, #7a9d54, #5c7a35);
}

.poop-golden {
  background: linear-gradient(to bottom, #f5d76e, #f1c40f);
  box-shadow: 0 0 10px rgba(241, 196, 15, 0.5), 2px 4px 8px rgba(0, 0, 0, 0.2);
}

/* 便便臉部表情 */
.poop-face {
  position: relative;
  width: 100%;
  height: 100%;
  animation: poop-bounce 5s ease-in-out infinite;
}

@keyframes poop-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.poop-eyes {
  position: absolute;
  top: 30%;
  width: 100%;
  display: flex;
  justify-content: space-around;
}

.poop-eyes::before,
.poop-eyes::after {
  content: '';
  width: 4px;
  height: 4px;
  background-color: #2c3e50;
  border-radius: 50%;
  position: relative;
  display: block;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.poop-eyes.happy::before,
.poop-eyes.happy::after {
  height: 2px;
  background-color: #2c3e50;
  border-radius: 0;
  margin-top: 2px;
  transform: rotate(-15deg);
}

.poop-eyes.happy::after {
  transform: rotate(15deg);
}

.poop-mouth {
  position: absolute;
  bottom: 30%;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 3px;
  background-color: #2c3e50;
  border-radius: 50% 50% 0 0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.poop-mouth.smile {
  border-radius: 0 0 50% 50%;
  height: 4px;
}

.poop-mouth.big-smile {
  border-radius: 0 0 50% 50%;
  height: 5px;
  width: 8px;
  animation: mouth-wiggle 3s ease-in-out infinite;
}

@keyframes mouth-wiggle {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.2, 0.8); }
}

.poop-1 {
  width: 30px;
  height: 26px;
  left: 15%;
  top: 35px;
  animation: float-poop 5s ease-in-out infinite;
  transform: rotate(-5deg);
}

.poop-1::before,
.poop-1::after {
  content: '';
  position: absolute;
  border-radius: 50%;
}

.poop-1::before {
  width: 22px;
  height: 22px;
  top: -10px;
  left: 4px;
  background: inherit;
}

.poop-1::after {
  width: 18px;
  height: 18px;
  top: -18px;
  left: 6px;
  background: inherit;
}

.poop-2 {
  width: 27px;
  height: 22px;
  left: 45%;
  right: auto;
  top: 25px;
  animation: float-poop 6s ease-in-out infinite 1s;
  transform: rotate(5deg);
}

.poop-2::before,
.poop-2::after {
  content: '';
  position: absolute;
  border-radius: 50%;
}

.poop-2::before {
  width: 20px;
  height: 20px;
  top: -9px;
  left: 3px;
  background: inherit;
}

.poop-2::after {
  width: 16px;
  height: 16px;
  top: -16px;
  left: 5px;
  background: inherit;
}

.poop-3 {
  width: 24px;
  height: 20px;
  left: 75%;
  top: 45px;
  animation: float-poop 4.5s ease-in-out infinite 0.5s;
  transform: rotate(-3deg);
}

.poop-3::before,
.poop-3::after {
  content: '';
  position: absolute;
  border-radius: 50%;
}

.poop-3::before {
  width: 18px;
  height: 18px;
  top: -8px;
  left: 3px;
  background: inherit;
}

.poop-3::after {
  width: 14px;
  height: 14px;
  top: -14px;
  left: 5px;
  background: inherit;
}

@keyframes float-poop {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-5px) rotate(5deg);
  }
  50% {
    transform: translateY(3px) rotate(-3deg);
  }
  75% {
    transform: translateY(-2px) rotate(2deg);
  }
}

/* 獎品顯示區域 */
.prize-display {
  padding: 16px;
  background-color: #fefefe;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
  text-align: center;
  max-width: 280px;
  margin: 15px auto 20px auto;
  transition: transform 0.3s ease;
  position: relative;
  overflow: hidden;
}

.prize-display:hover {
  transform: translateY(-2px);
}

.prize-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 2;
}

.prize-name {
  font-size: 1em;
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 8px;
  width: 100%;
  letter-spacing: 0.2px;
  line-height: 1.4;
  font-style: italic;
}

.prize-rarity {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-block;
  margin-top: 4px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  letter-spacing: 0.3px;
}

.rarity-common {
  background-color: #95a5a6;
  color: white;
}

.rarity-uncommon {
  background-color: #27ae60;
  color: white;
}

.rarity-rare {
  background-color: #f39c12;
  color: white;
}

.rarity-ultra-rare {
  background-color: #e74c3c;
  color: white;
}

.prize-display.rarity-common,
.prize-display.rarity-uncommon,
.prize-display.rarity-rare,
.prize-display.rarity-ultra-rare {
  background-color: #fefefe;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
}

.gacha-message {
  margin: 10px 0;
  font-size: 14px;
  color: #34495e;
  text-align: center;
  min-height: 20px;
  font-weight: 500;
  padding: 4px 8px;
  max-width: 200px;
  margin-left: auto;
  margin-right: auto;
  border-radius: 15px;
  background-color: #f8f9fa;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

/* 獎品歷史 */
.prize-history {
  margin-top: 30px;
  width: 100%;
  max-width: 350px;
  background-color: #fdfaf7;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
}

.prize-history h2 {
  font-size: 20px;
  margin-bottom: 15px;
  text-align: center;
  color: #4a3f35;
  position: relative;
  padding-bottom: 10px;
}

.prize-history h2::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 2px;
  background-color: #d6c2a1;
  border-radius: 2px;
}

.prize-history ul {
  list-style: none;
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e9e2d6;
  border-radius: 8px;
  background-color: white;
}

.prize-history li {
  padding: 12px 15px;
  border-bottom: 1px solid #f5f0e8;
  transition: background-color 0.2s;
  color: #4a3f35;
  font-size: 0.9em;
  line-height: 1.4;
  text-align: left;
  font-style: italic;
}

.prize-history li:hover {
  background-color: #fdfaf7;
}

.prize-history li:last-child {
  border-bottom: none;
}
</style> 