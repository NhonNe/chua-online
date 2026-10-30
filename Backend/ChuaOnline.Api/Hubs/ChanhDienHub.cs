using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace ChuaOnline.Api.Hubs;

public sealed record MonkPlayer(
    string ConnectionId,
    string PlayerId,
    string Name,
    string RoomId,
    float X,
    float Y,
    float Z,
    float RotY,
    float Speed,
    int Posture,
    bool IsMoving,
    int SeatIndex,
    DateTime JoinedAtUtc
);

public sealed class ChanhDienHub : Hub
{
    private static readonly ConcurrentDictionary<string, MonkPlayer> Players = new();
    private static readonly ConcurrentDictionary<string, HashSet<string>> Rooms = new();

    public async Task JoinRoom(string roomId, string playerName)
    {
        roomId = string.IsNullOrWhiteSpace(roomId) ? "chanh-dien-01" : roomId;
        playerName = string.IsNullOrWhiteSpace(playerName) ? $"Đồng tu {Random.Shared.Next(1000, 9999)}" : playerName;

        var player = new MonkPlayer(
            ConnectionId: Context.ConnectionId,
            PlayerId: Context.ConnectionId[..8],
            Name: playerName,
            RoomId: roomId,
            X: 0f,
            Y: 0.05f,
            Z: -10f,
            RotY: 0f,
            Speed: 0f,
            Posture: 0,
            IsMoving: false,
            SeatIndex: -1,
            JoinedAtUtc: DateTime.UtcNow
        );

        Players[Context.ConnectionId] = player;
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

        Rooms.AddOrUpdate(roomId,
            _ => [Context.ConnectionId],
            (_, set) => { lock (set) { set.Add(Context.ConnectionId); } return set; });

        var roomPlayers = GetRoomPlayers(roomId);
        var totalOnline = roomPlayers.Count;

        // Báo cho người vừa vào danh sách hiện tại
        await Clients.Caller.SendAsync("Welcome", new
        {
            Self = player,
            Room = roomId,
            TotalOnline = totalOnline,
            Players = roomPlayers
        });

        // Báo cho những người khác trong phòng
        await Clients.OthersInGroup(roomId).SendAsync("PlayerJoined", new
        {
            Player = player,
            TotalOnline = totalOnline
        });
    }

    public async Task SendMovement(float x, float y, float z, float rotY, float speed, int posture, bool isMoving)
    {
        if (!Players.TryGetValue(Context.ConnectionId, out var existing)) return;

        var updated = existing with
        {
            X = x,
            Y = y,
            Z = z,
            RotY = rotY,
            Speed = speed,
            Posture = posture,
            IsMoving = isMoving
        };
        Players[Context.ConnectionId] = updated;

        await Clients.OthersInGroup(updated.RoomId).SendAsync("PlayerMoved", new
        {
            Id = updated.PlayerId,
            X = x,
            Y = y,
            Z = z,
            RotY = rotY,
            Speed = speed,
            Posture = posture,
            IsMoving = isMoving
        });
    }

    public async Task SendAction(string action)
    {
        if (!Players.TryGetValue(Context.ConnectionId, out var player)) return;

        await Clients.Group(player.RoomId).SendAsync("PlayerAction", new
        {
            Id = player.PlayerId,
            Name = player.Name,
            Action = action,
            Timestamp = DateTime.UtcNow
        });
    }

    public async Task SelectSeat(int seatIndex)
    {
        if (!Players.TryGetValue(Context.ConnectionId, out var player)) return;

        var updated = player with { SeatIndex = seatIndex, Posture = 1, IsMoving = false };
        Players[Context.ConnectionId] = updated;

        await Clients.OthersInGroup(player.RoomId).SendAsync("PlayerSeated", new
        {
            Id = player.PlayerId,
            SeatIndex = seatIndex
        });
    }

    public async Task StandUp()
    {
        if (!Players.TryGetValue(Context.ConnectionId, out var player)) return;

        var updated = player with { SeatIndex = -1, Posture = 0 };
        Players[Context.ConnectionId] = updated;

        await Clients.OthersInGroup(player.RoomId).SendAsync("PlayerStood", new
        {
            Id = player.PlayerId
        });
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Players.TryRemove(Context.ConnectionId, out var player))
        {
            if (Rooms.TryGetValue(player.RoomId, out var set))
            {
                lock (set) { set.Remove(Context.ConnectionId); }
            }

            var totalOnline = GetRoomPlayers(player.RoomId).Count;
            await Clients.Group(player.RoomId).SendAsync("PlayerLeft", new
            {
                Id = player.PlayerId,
                Name = player.Name,
                TotalOnline = totalOnline
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    private static List<MonkPlayer> GetRoomPlayers(string roomId)
    {
        if (!Rooms.TryGetValue(roomId, out var set)) return [];
        lock (set)
        {
            return set.Select(id => Players.TryGetValue(id, out var p) ? p : null)
                      .Where(p => p != null)
                      .Select(p => p!)
                      .ToList();
        }
    }
}
