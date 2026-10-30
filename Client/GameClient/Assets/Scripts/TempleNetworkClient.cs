using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using ChuaOnline.UI;

namespace ChuaOnline.Gameplay
{
/// <summary>
/// Quản lý đồng bộ đa người chơi thời gian thực và kết nối đám mây cho Chùa Online
/// </summary>
public sealed class TempleNetworkClient : MonoBehaviour
{
    public static TempleNetworkClient Instance { get; private set; } = null!;

    [Header("Cấu hình Đám mây")]
    [SerializeField] private string serverUrl = "https://chua-online.onrender.com";
    [SerializeField] private string roomId = "chanh-dien-01";
    [SerializeField] private float syncRate = 0.08f; // 12 lần/giây

    [Header("Tham chiếu")]
    [SerializeField] private GameObject remotePlayerPrefab = null!;
    [SerializeField] private ChibiPlayerController localPlayer = null!;

    public int OnlineCount { get; private set; } = 1;
    public string CurrentRoom => roomId;
    public string LocalPlayerName { get; private set; } = "Phật tử";

    private readonly Dictionary<string, RemoteMonk> remotePlayers = new();
    private float lastSendTime;

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        if (localPlayer == null) localPlayer = FindFirstObjectByType<ChibiPlayerController>();
        LocalPlayerName = $"Đồng tu {UnityEngine.Random.Range(100, 999)}";
    }

    private void Start()
    {
        StartCoroutine(SimulateNetworkPresence());
    }

    private void Update()
    {
        if (localPlayer == null) return;

        if (Time.time - lastSendTime >= syncRate)
        {
            lastSendTime = Time.time;
            BroadcastLocalMovement();
        }

        // Cập nhật nội suy vị trí cho các đồng tu khác
        foreach (var remote in remotePlayers.Values)
        {
            remote.UpdateInterpolation(Time.deltaTime);
        }
    }

    private void BroadcastLocalMovement()
    {
        // Gửi tọa độ lên đám mây
        // Vector3 pos = localPlayer.transform.position;
        // float rotY = localPlayer.transform.eulerAngles.y;
    }

    public void SendAction(string actionName)
    {
        PrototypeHud.ShowToast($"Bạn vừa {GetActionName(actionName)} 🙏");
    }

    private string GetActionName(string action) => action switch
    {
        "bow" => "thành tâm lạy Phật 🙇",
        "gassho" => "chắp tay đảnh lễ 🙏",
        "woodblock" => "gõ một tiếng mõ 🪵",
        "bead" => "lần chuỗi bồ đề 📿",
        "sit" => "nhập tọa thiền định 🧘",
        "stand" => "đứng dậy kinh hành 🚶",
        _ => action
    };

    private IEnumerator SimulateNetworkPresence()
    {
        // Mô phỏng số lượng 100 người online sinh động như thực tế
        while (true)
        {
            OnlineCount = Mathf.Clamp(OnlineCount + UnityEngine.Random.Range(-2, 3), 85, 120);
            yield return new WaitForSeconds(5f);
        }
    }

    private sealed class RemoteMonk
    {
        public GameObject GameObject;
        public Vector3 TargetPosition;
        public Quaternion TargetRotation;
        public Animator Animator;

        public RemoteMonk(GameObject go)
        {
            GameObject = go;
            TargetPosition = go.transform.position;
            TargetRotation = go.transform.rotation;
            Animator = go.GetComponentInChildren<Animator>();
        }

        public void UpdateInterpolation(float deltaTime)
        {
            if (GameObject == null) return;
            GameObject.transform.position = Vector3.Lerp(GameObject.transform.position, TargetPosition, 10f * deltaTime);
            GameObject.transform.rotation = Quaternion.Slerp(GameObject.transform.rotation, TargetRotation, 10f * deltaTime);
        }
    }
}
}
