# CHUA ONLINE – Unity 3D Prototype

## Mở project

1. Mở Unity Hub.
2. Chọn **Add** và trỏ tới `Client/GameClient`.
3. Dùng Unity `6000.3.27f1`.
4. Mở scene `Assets/Scenes/TempleWorld.unity`.

Nếu scene chưa tồn tại, chạy menu `CHUA ONLINE > Build TempleWorld Prototype`. Builder tạo scene, prefab chibi, materials và AnimationClips prototype.

## Điều khiển

- WASD: di chuyển.
- Left Shift: chạy.
- Giữ chuột phải + rê chuột: xoay camera third-person.
- C: ngồi, X: quỳ, Z: cúi lạy.

## Phạm vi prototype

Scene hiện dùng procedural low-poly geometry có nhiều lớp kiến trúc, vật liệu, ánh sáng và chi tiết sân chùa để kiểm tra bố cục/gameplay. Chưa có model 3D nghệ thuật cuối, rig humanoid chuẩn, mocap hoặc audio; các tài nguyên đó sẽ thay thế prefab/material/animation prototype ở phase art production.

Các AnimationClips được builder tạo thật cho hierarchy xương prototype, nhưng chưa phải animation humanoid chất lượng production.

## Kiểm thử

Prototype phải được mở trong Unity Editor để kiểm tra Scene view/Game view. Chạy Play, kiểm tra WASD, camera và ba posture. Không có Photon, multiplayer hoặc thay đổi Backend/PostgreSQL trong phase này.
