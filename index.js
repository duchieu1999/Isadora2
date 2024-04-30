const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const cron = require('node-cron'); // Thư viện để thiết lập cron jobs
const keep_alive = require('./keep_alive.js')

// Kết nối tới MongoDB
mongoose.connect(
  'mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const db = mongoose.connection;

// Định nghĩa schema cho bảng công
const BangCongSchema = new mongoose.Schema({
  userId: Number,
  groupId: Number,
  date: Date,
  ten: String,
  quay: Number,
  keo: Number,
  tinh_tien: Number,
});

// Tạo model từ schema
const BangCong2 = mongoose.model('BangCong2', BangCongSchema);

const token = '7150645082:AAGUNk7BrBPYJqv085nINEGx7p5tCE9WcK0';
const bot = new TelegramBot(token, { polling: true });

// Chuỗi cấm
const bannedStringsRegex = /(ca\s?1|ca1|ca\s?2|Ca\s?2|Ca\s?1|Ca1|Ca\s?2|Ca2|C1|C2|c\s?1|c\s?2|C\s?1|C\s?2)\s*/gi;

// Thiết lập cron job để xóa dữ liệu bảng công của ngày hôm trước
cron.schedule('0 0 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const formattedYesterday = new Date(yesterday.toLocaleDateString());

  try {
    const result = await BangCong2.deleteMany({ date: formattedYesterday });
    console.log(`Đã xóa ${result.deletedCount} bảng công của ngày ${formattedYesterday.toLocaleDateString()}`);
  } catch (error) {
    console.error("Lỗi khi xóa dữ liệu từ MongoDB:", error);
  }
});

            



bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // Chỉ kiểm tra nếu không phải là nhóm có ID
  if (chatId !== -1002103270166) {
    // Kiểm tra nếu tin nhắn chứa chuỗi cấm
    if ((msg.text || msg.caption) && bannedStringsRegex.test(msg.text || msg.caption)) {
      const messageContent = msg.text || msg.caption;
      const userId = msg.from.id;
      const groupId = chatId;

      // Tìm tất cả số và ký tự sau số
      // Tìm tất cả số theo sau bởi q, c, Q, C, quẩy, cộng, hoặc acc
      const matches = messageContent.match(/\d+(q|c|Q|C|quẩy|cộng|acc)/gi);
      let quay = 0;
      let keo = 0;

      if (matches) {
        matches.forEach((match) => {
          const number = parseInt(match); // Lấy số
          const suffix = match.slice(number.toString().length); // Lấy chữ cái hoặc từ theo sau số

          if (suffix.toLowerCase() === 'q' || suffix.toLowerCase() === 'p') {
            quay += number; // Nếu sau số là "q" hoặc "Q", thêm vào "quay"
          } else if (suffix.toLowerCase() === 'c' || suffix === 'acc') {
            keo += number; // Nếu sau số là "c", "C", hoặc "acc", thêm vào "keo"
          } else if (suffix === 'quẩy') {
            quay += number; // Nếu sau số là "quẩy", thêm vào "quay"
          } else if (suffix === 'cộng') {
            keo += number; // Nếu sau số là "cộng", thêm vào "keo"
          }
        });
      }

      bot.sendMessage(chatId, 'Bài nộp hợp lệ, đã ghi vào bảng công ❤🥳', { reply_to_message_id: msg.message_id }).then(async () => {
        const currentDate = new Date().toLocaleDateString();
        const firstName = msg.from.first_name;
        const lastName = msg.from.last_name;
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;

        let bangCong = await BangCong2.findOne({ userId, groupId, date: currentDate });

        if (!bangCong) {
          bangCong = await BangCong2.create({
            userId,
            groupId,
            date: currentDate,
            ten: fullName,
            quay,
            keo,
            tinh_tien: quay * 500 + keo * 1000,
          });
        } else {
          bangCong.quay += quay;
          bangCong.keo += keo;
          bangCong.tinh_tien += quay * 500 + keo * 1000;

          await bangCong.save();
        }
      });
    }
  }
});
                                             
          
// Bảng tra cứu tên nhóm dựa trên ID nhóm
const groupNames = {
  "-1002039100507": "CỘNG ĐỒNG NẮM BẮT CƠ HỘI",
  "-1002004082575": "KHÔNG NGỪNG PHÁT TRIỂN",
  "-1002123430691": "DẪN LỐI THÀNH CÔNG",
  "-1002143712364": "CURRENCY SHINING STAR GROUP",
};

// Xử lý lệnh /bc để hiển thị bảng công cho tất cả các nhóm
bot.onText(/\/bc/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const currentDate = new Date().toLocaleDateString(); // Ngày hiện tại
    const bangCongs = await BangCong2.find({ date: currentDate }); // Lấy bảng công cho ngày hiện tại
    
    if (bangCongs.length === 0) {
      bot.sendMessage(chatId, "Không có bảng công nào cho ngày hôm nay.");
      return;
    }

    // Tạo bảng công phân loại theo ID nhóm
    const groupedByGroupId = {};
    bangCongs.forEach((bangCong) => {
      const groupId = bangCong.groupId ? bangCong.groupId.toString() : ''; // Kiểm tra nếu groupId không undefined
      if (!groupedByGroupId[groupId]) {
        groupedByGroupId[groupId] = [];
      }
      groupedByGroupId[groupId].push(bangCong);
    });

    let response = '';

    // Tạo bảng công cho mỗi nhóm
    for (const groupId in groupedByGroupId) {
      if (!groupId) {
        continue; // Bỏ qua nếu groupId không hợp lệ
      }

      const groupData = groupedByGroupId[groupId];
      const groupName = groupNames[groupId] || `Nhóm ${groupId}`; // Lấy tên nhóm từ bảng tra cứu

      response += `Bảng công nhóm ${groupName}:\n`;
      response += 'HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTỔNG TIỀN💰\n';

      let totalGroupMoney = 0; // Biến để tính tổng số tiền của nhóm

      groupData.forEach((bangCong) => {
        if (bangCong.tinh_tien !== undefined) { // Kiểm tra trước khi truy cập thuộc tính
          const formattedTien = bangCong.tinh_tien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          response += `${bangCong.ten}\t\t${bangCong.quay}q +\t${bangCong.keo}c\t${formattedTien}vnđ\n`;
          totalGroupMoney += bangCong.tinh_tien; // Tính tổng tiền
        }
      });

      const formattedTotal = totalGroupMoney.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      response += `Tổng tiền của nhóm ${groupName}: ${formattedTotal}vnđ\n\n`; // Hiển thị tổng tiền của nhóm
    }

    bot.sendMessage(chatId, response.trim());
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu từ MongoDB:', error);
    bot.sendMessage(chatId, 'Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.');
  }
});

   

bot.onText(/\/tong/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const currentDate = new Date(); // Ngày hiện tại

    // Truy vấn để tổng hợp bảng công của các thành viên trong ngày hiện tại
    const aggregatedData = await BangCong2.aggregate([
      {
        $match: { date: new Date(currentDate.toLocaleDateString()) }, // Lọc theo ngày hiện tại
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            ten: "$ten",
          },
          totalQuay: { $sum: "$quay" },
          totalKeo: { $sum: "$keo" },
          totalTinhTien: { $sum: "$tinh_tien" },
        },
      },
      {
        $sort: { totalTinhTien: -1 }, // Sắp xếp theo tổng tiền giảm dần
      },
    ]);

    if (aggregatedData.length === 0) {
      bot.sendMessage(chatId, "Không có bảng công nào cho ngày hôm nay.");
      return;
    }

    let response = "Bảng công tổng hợp cho ngày hôm nay:\n\n";
    response += "HỌ TÊN👩‍🎤\t\tQUẨY💃\tCỘNG➕\tTỔNG TIỀN💰\n";

    aggregatedData.forEach((data) => {
      const formattedTotal = data.totalTinhTien.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      response += `${data._id.ten}\t\t${data.totalQuay}q +\t${data.totalKeo}c\t${formattedTotal}vnđ\n`;
    });

    bot.sendMessage(chatId, response);
  } catch (error) {
    console.error("Lỗi khi truy vấn dữ liệu từ MongoDB:", error);
    bot.sendMessage(chatId, "Đã xảy ra lỗi khi truy vấn dữ liệu từ cơ sở dữ liệu.");
  }
});
