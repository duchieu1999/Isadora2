const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const mongoose = require('mongoose');
const cron = require('node-cron');
const keep_alive = require('./keep_alive.js')


const token = '7161535723:AAHpmjnS9lD_iknkXFZOgwkrTR_8WE5iZJs';
const bot = new TelegramBot(token, { polling: true });

// Kết nối tới MongoDB
mongoose.connect('mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

// Địnnghĩa schema cho bảng công
const BangCong2Schema = new mongoose.Schema({
    userId: Number,
    date: Date,
    ten: String,
    quay: Number,
    keo: Number,
    image: Number,
    tinh_tien: Number
});

// Tạo model từ schema
const BangCong2 = mongoose.model('BangCong2', BangCong2Schema);

// Đường dẫn tới file lưu trữ dữ liệu
const dataFilePath = 'members_photos.json';

// Load dữ liệu từ file
let membersPhotos = {};
if (fs.existsSync(dataFilePath)) {
    membersPhotos = JSON.parse(fs.readFileSync(dataFilePath));
}

// Chuỗi cấm
const bannedStringsRegex = /(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2|C1|C2|c\s?1|c\s?2|C\s?1|C\s?2)\s*/gi;

// Lưu trữ tin nhắn chứa hình ảnh của từng thành viên
let photoMessages = {};

// Hàm gửi bảng công vào thời điểm cố định hàng ngày
async function sendDailyReport() {
    const currentDate = new Date().toLocaleDateString(); // Ngày hiện tại
    const currentHour = new Date().getUTCHours(); // Lấy giờ hiện tại theo múi giờ UTC
    const currentMinute = new Date().getUTCMinutes(); // Lấy phút hiện tại theo múi giờ UTC

    // Kiểm tra xem có đến thời điểm gửi bảng công không
    if ((currentHour === 14 && currentMinute === 0) || (currentHour === 7 && currentMinute === 0)) { // 17h13 theo múi giờ UTC tương đương 00h13 theo múi giờ Việt Nam
        const chatId = '-1002103270166'; // Thay thế bằng ID của nhóm muốn gửi bảng công

        let response = `Bảng Công Hôm Nay ${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}  (Cập nhật lại tự động sau mỗi ca):\n\n`;
        response += 'HỌ TÊN | QUẨY | KÉO | TIỀN\n\n';

        try {
            const bangCong2s = await BangCong2.find({ date: currentDate });

            bangCong2s.forEach(bangCong2 => {
                const formattedTien = bangCong2.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Định dạng số tiền thành dạng ngăn cách bằng dấu chấm
                response += `${bangCong2.ten} | ${bangCong2.quay} | ${bangCong2.keo} | ${formattedTien} VNĐ\n`;
            });
        } catch (error) {
            console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
            response += 'Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.';
        }

        bot.sendMessage(chatId, response);
    }
}

// Kiểm tra thời gian và gửi bảng công mỗi phút
setInterval(sendDailyReport, 60000); // Kiểm tra mỗi phút

// Hàm gửi tin nhắn ngẫu nhiên vào 7h hàng ngày
function sendRandomMessage() {
    // Tin nhắn ngẫu nhiên
    const randomMessages = [
        "Chào buổi sáng! Thời gian để 'quẩy' cùng nhau!",
        "Một ngày mới tràn đầy năng lượng!",
        "Cùng nhau vượt qua mọi thử thách!"
    ];

    const randomIndex = Math.floor(Math.random() * randomMessages.length);
    const randomMessage = randomMessages[randomIndex];

    const chatId = '-1002103270166'; // Thay thế bằng ID của nhóm muốn gửi tin nhắn

    const currentHour = new Date().getUTCHours(); // Giờ UTC
    const currentMinute = new Date().getUTCMinutes(); // Phút UTC

    if (currentHour === 0 && currentMinute === 0) { // 7h sáng giờ Việt Nam
        bot.sendMessage(chatId, randomMessage);
    }
}

// Thiết lập hẹn giờ để gửi tin nhắn vào 7h hàng ngày
setInterval(sendRandomMessage, 24 * 60 * 60 * 1000); // 24 giờ

// Mảng các lời nhắn ngẫu nhiên cho các thời điểm khác
const moreRandomMessages = [
    "5 phút nữa là đến giờ rồi!",
    "Chuẩn bị 'quẩy' nào!",
    "Hãy cùng nhau vượt qua mọi khó khăn!"
];

// Hàm gửi tin nhắn ngẫu nhiên vào lúc 12h50 và 19h50 hàng ngày
cron.schedule('35 11,19 * * *', () => {
    const randomIndex = Math.floor(Math.random() * moreRandomMessages.length);
    const message = moreRandomMessages[randomIndex];
    const chatId = '-1002103270166'; // Thay thế bằng ID của nhóm muốn gửi tin nhắn
    bot.sendMessage(chatId, message);
}, {
    timezone: "Asia/Ho_Chi_Minh"
});

// Sử lý tin nhắn khi chúng có chứa ảnh hoặc văn bản
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (msg.photo || msg.caption) {
        const userId = msg.from.id;

        // Lưu tin nhắn gửi hình ảnh hoặc caption của thành viên
        const messageData = { messageId: msg.message_id, date: msg.date, caption: msg.caption };
        photoMessages[userId] = photoMessages[userId] || [];
        photoMessages[userId].push(messageData);

        // Tăng số ảnh đã gửi của thành viên
        membersPhotos[userId] = (membersPhotos[userId] || 0) + 1;

        // Lưu dữ liệu vào file
        fs.writeFileSync(dataFilePath, JSON.stringify(membersPhotos));

        // Reset tổng số ảnh của thành viên sau 10 giây
        setTimeout(() => {
            membersPhotos[userId] = 0;
            fs.writeFileSync(dataFilePath, JSON.stringify(membersPhotos));
        }, 30 * 60 * 1000); // 30 phút
    }

    // Kiểm tra nếu tin nhắn chứa chuỗi cấm
    if ((msg.text || msg.caption) && bannedStringsRegex.test(msg.text || msg.caption)) {
        const messageContent = msg.text || msg.caption;
        const userId = msg.from.id;
        const userFullName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();

        if (true) {
            bot.sendMessage(chatId, 'Bài nộp hợp lệ, đã ghi vào bảng công ❤🥳', { reply_to_message_id: msg.message_id }).then(async () => {
                // Reset tổng số ảnh của thành viên
                membersPhotos[userId] = 0;
                fs.writeFileSync(dataFilePath, JSON.stringify(membersPhotos));

                // Lưu dữ liệu vào MongoDB
                const currentDate = new Date().toLocaleDateString();

                let bangCong2 = await BangCong2.findOne({ userId, date: currentDate });

                if (!bangCong2) {
                    // Cộng quẩy, kéo và số ảnh
                    let quay = 0;
                    let keo = 0;
                    const numbers = messageContent.replace(bannedStringsRegex, '').match(/\d+/g);
                    if (numbers) {
                        quay = parseInt(numbers[0], 10) || 0;
                        keo = parseInt(numbers[1], 10) || 0;
                    }
                    let image = 0;
                    const images = messageContent.match(/\b\d+\s*ảnh\b/gi);
                    if (images) {
                        image = images.reduce((acc, img) => acc + parseInt(img), 0);
                    }

                    bangCong2 = await BangCong2.create({
                        userId,
                        date: currentDate,
                        ten: userFullName,
                        quay,
                        keo,
                        image,
                        tinh_tien: quay * 500 + keo * 1000 + image * 2000
                    });
                } else {
                    // Cập nhật dữ liệu bảng công
                    let quay = 0;
                    let keo = 0;
                    const numbers = messageContent.replace(bannedStringsRegex, '').match(/\d+/g);
                    if (numbers) {
                        quay += parseInt(numbers[0], 10) || 0;
                        keo += parseInt(numbers[1], 10) || 0;
                    }
                    let image = 0;
                    const images = messageContent.match(/\b\d+\s*ảnh\b/gi);
                    if (images) {
                        image += images.reduce((acc, img) => acc + parseInt(img), 0);
                    }

                    bangCong2.quay += quay;
                    bangCong2.keo += keo;
                    bangCong2.image += image;
                    bangCong2.tinh_tien = bangCong2.quay * 500 + bangCong2.keo * 1000 + bangCong2.image * 2000;

                    await bangCong2.save();
                }
            });
        }
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    // Kiểm tra nếu tin nhắn là lời chào và gửi URL hình ảnh vào nhóm
    if (msg.text === '/start') {
        bot.sendMessage(chatId, 'Chào các cậu, tớ là Isadora đây 🐷, tớ là AI trợ lý của anh Hieu Gà 🐔, tớ sẽ quản lý bài nộp giúp mọi người nhé! 👩‍🎤👋');
        const imageUrl = 'https://iili.io/Jvt7fTP.png'; // Thay đổi URL hình ảnh của bot ở đây
        bot.sendPhoto(chatId, imageUrl);
    }

    // Kiểm tra nếu tin nhắn của thành viên chứa các từ chào hỏi
    if (msg.text && /(chào bot|chào chị|chào isadora|Isadora)/i.test(msg.text)) {
        bot.sendMessage(chatId, 'Chào cậu, tớ là Isadora đây 🐷, tớ là AI trợ lý của anh Hieu Gà 🐔 , có gì khó khăn cứ nhắn tớ nhé! 👩‍🎤', { reply_to_message_id: msg.message_id });
    }

    // Kiểm tra nếu có ai đó trích dẫn tin nhắn gốc của bot
    if (msg.reply_to_message && msg.reply_to_message.from.username === 'Trolyaihieuga_bot') {
        bot.sendMessage(chatId, "Tớ ko hiểu 🥺, tớ chỉ là AI được anh Hieu Gà đào tạo để quản lý bài nộp của mọi người 😊. Hi vọng tương lai tớ sẽ biết nhiều thứ hơn 🤯", { reply_to_message_id: msg.message_id });
    }
});

bot.onText(/\/bc/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Lấy dữ liệu bảng công từ MongoDB cho ngày hiện tại
        const currentDate = new Date().toLocaleDateString(); // Ngày hiện tại
        const bangCong2s = await BangCong2.find({ date: currentDate });

        let response = '';
        response += `Bảng Công Ngày Hôm Nay (${currentDate}):\n\n`;
        response += 'HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTỔNG TIỀN💰\n\n';

        bangCong2s.forEach(bangCong => {
            const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Định dạng số tiền thành dạng ngăn cách bằng dấu chấm
            response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
        });

        if (response === '') {
            response = 'Chưa có số nào được gửi trong nhóm vào ngày hôm nay.';
        }

        bot.sendMessage(chatId, response);
    } catch (error) {
        console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.');
    }
});

// Lệnh để tính toán bảng công theo ngày mà người dùng yêu cầu
bot.onText(/\/bc(\d{1,2})?\/(\d{1,2})?\/(\d{4})?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const requestedDate = match[0] 
        ? new Date(`${match[3] || new Date().getFullYear()}-${match[2] || (new Date().getMonth() + 1)}-${match[1] || new Date().getDate()}`).toLocaleDateString() 
        : new Date().toLocaleDateString();

    let response = `Bảng công ngày ${requestedDate}:\n`;
    response += 'HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTIỀN💰\n';

    let found = false;
    const bangCong2s = await BangCong2.find({ date: requestedDate });

    bangCong2s.forEach(bangCong => {
        response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${bangCong.tinh_tien}vnđ\n`;
        found = true;
    });

    if (!found) {
        response = 'Không có dữ liệu cho ngày này.';
    }

    bot.sendMessage(chatId, response);
});

bot.onText(/\/resetbc/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const member = await bot.getChatMember(chatId, userId);
        const isAdmin = member.status === 'creator' || member.status === 'administrator';

        if (!isAdmin) {
            bot.sendMessage(chatId, 'Bạn không có quyền reset dữ liệu bảng công.');
            return;
        }

        const currentDate = new Date().toLocaleDateString();

        // Xóa dữ liệu bảng công cho ngày hiện tại từ MongoDB
        await BangCong2.deleteMany({ date: currentDate });

        bot.sendMessage(chatId, `Đã reset dữ liệu bảng công cho ngày ${currentDate}.`);
    } catch (error) {
        console.error('Lỗi khi reset dữ liệu bảng công:', error);
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi reset dữ liệu bảng công.');
    }
});

bot.onText(/Tính bc mới/i, async (msg) => {
    const chatId = msg.chat.id;

    try {
        bot.sendMessage(chatId, "Dạ, Isadora đã ghi nhận. Bắt đầu tính tổng lương mới từ hôm nay ạ👌", { reply_to_message_id: msg.message_id });

        const currentDate = new Date().toLocaleDateString();

        // Xóa dữ liệu bảng công cho các ngày trước đó từ MongoDB
        await BangCong2.deleteMany({ date: { $lt: currentDate } });
    } catch (error) {
        console.error('Lỗi khi reset dữ liệu bảng công:', error);
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi reset dữ liệu bảng công.');
    }
});

// Lệnh để hiển thị bảng công của từng ngày trong cơ sở dữ liệu
bot.onText(/(Chốt bc|Xem tổng bc)/i, async (msg) => {
    const chatId = msg.chat.id;
    const randomResponse = [
        "Chào anh Hiếu Gà, Isadora đây ạ! 🙋‍♀️ Bảng công tổng đây ạ, anh xem có cần chỉnh sửa gì không ạ? 📋",
        "Xin chào anh Hiếu Gà! Bảng công tổng nóng hổi vừa ra lò, anh xem và góp ý cho em nhé! ♨️",
        "Isadora gửi bảng công tổng cho anh Hiếu Gà đây ạ! Nhớ kiểm tra kỹ và phản hồi cho em nha! 💌",
        "Bảng công tổng đã đến tay anh Hiếu Gà rồi ạ! Anh xem có gì cần chỉnh sửa thì cứ báo em nhé! 📝",
        "Isadora gửi bảng công tổng cho anh Hiếu Gà với tốc độ ánh sáng! ⚡️",
        "Bảng công tổng đã được Isadora chuẩn bị chu đáo, anh Hiếu Gà chỉ việc kiểm tra và duyệt thôi ạ! ✅",
        "Chúc anh và mọi người một ngày làm việc hiệu quả và suôn sẻ với bảng công tổng đầy đủ thông tin! 📈",
        "Đây là bảng công tổng, cùng Isadora hoàn thành công việc một cách xuất sắc nào! 💪",
        "Isadora luôn sẵn sàng hỗ trợ anh Hiếu Gà và mọi người mọi lúc mọi nơi! 🤗",
        "Em xin gửi bảng công tổng, chúc cả team một ngày làm việc vui vẻ và gặt hái được nhiều thành công! 🎉"
    ];

    try {
        let response = '';

        // Lấy tất cả các ngày có dữ liệu bảng công từ MongoDB
        const dates = await BangCong2.distinct('date');

        // Hiển thị bảng công của từng ngày
        for (const date of dates) {
            const bangCongs = await BangCong2.find({ date });

            const formattedDate = new Date(date).toLocaleDateString('vi-VN'); // Định dạng ngày theo chuẩn Việt Nam

            response += `Bảng Công Ngày ${formattedDate}:\n\n`;
            response += 'TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTIỀN💰\n';
            
            bangCongs.forEach(bangCong => {
                const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Định dạng số tiền ngăn cách bằng dấu chấm
                response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
            });

            response += '\n\n';
        }

        // Tính toán tổng bảng công và tổng tiền của tất cả thành viên từ tất cả các ngày
        const totalBangCong = {};
        let totalMoney = 0;
        for (const date of dates) {
            const bangCongs = await BangCong2.find({ date });

            bangCongs.forEach(bangCong => {
                if (!totalBangCong[bangCong.userId]) {
                    totalBangCong[bangCong.userId] = {
                        ten: bangCong.ten,
                        quay: 0,
                        keo: 0,
                        tinh_tien: 0
                    };
                }

                totalBangCong[bangCong.userId].quay += bangCong.quay;
                totalBangCong[bangCong.userId].keo += bangCong.keo;
                totalBangCong[bangCong.userId].tinh_tien += bangCong.tinh_tien;
                totalMoney += bangCong.tinh_tien;
            });
        }

        // Hiển thị tổng bảng công và tổng tiền của tất cả thành viên
        response += '\nTổng Bảng Công Các Ngày:\n\n';
        response += 'TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTIỀN💰\n';

        for (const userId in totalBangCong) {
            const bangCong = totalBangCong[userId];
            const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
        }

        const formattedTotalMoney = totalMoney.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Định dạng tổng tiền
        response += `\nTổng tiền của CTV: ${formattedTotalMoney}vnđ`;

        // Gửi thông điệp chứa bảng công của từng ngày và tổng bảng công của tất cả thành viên
        bot.sendMessage(chatId, response);

        // Phản hồi cho quản trị viên với nội dung ngẫu nhiên
        const randomIndex = Math.floor(Math.random() * randomResponse.length);
        const replyMessage = randomResponse[randomIndex];
        bot.sendMessage(chatId, replyMessage, { reply_to_message_id: msg.message_id });
    } catch (error) {
        console.error('Lỗi khi hiển thị bảng công:', error);
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi hiển thị bảng công.');
    }
});


// Lệnh để xử lý tin nhắn của quản trị viên để cập nhật dữ liệu bảng công từ tin nhắn của quản trị viên
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    const member = await bot.getChatMember(chatId, msg.from.id);

    if (member.status === 'creator' || member.status === 'administrator') {
        if (!msg.reply_to_message && msg.text) {
            const editedContent = msg.text.trim();
            const userInfoRegex = /(.+),\s*(\d+)\s*q,\s*(\d+)\s*c/;
            const matches = editedContent.match(userInfoRegex);

            if (matches) {
                const fullName = matches[1].trim();
                const quay = parseInt(matches[2]);
                const keo = parseInt(matches[3]);

                try {
                    const currentDate = new Date().toLocaleDateString();

                    let bangCong = await BangCong2.findOne({ ten: fullName, date: currentDate });

                    if (bangCong) {
                        bangCong.quay = quay;
                        bangCong.keo = keo;
                        bangCong.tinh_tien = quay * 500 + keo * 1000;
                        await bangCong.save();
                    } else {
                        bangCong = await BangCong2.create({
                            ten: fullName,
                            quay,
                            keo,
                            tinh_tien: quay * 500 + keo * 1000,
                            date: currentDate
                        });
                    }

                    bot.sendMessage(chatId, "Em đã cập nhật bảng công như anh yêu cầu");
                } catch (error) {
                    console.error('Lỗi khi cập nhật bảng công:', error);
                    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi cập nhật bảng công.');
                }
            }
        }
    }
});


