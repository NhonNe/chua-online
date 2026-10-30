using System.Collections;
using UnityEngine;
using ChuaOnline.Gameplay;

namespace ChuaOnline.UI
{
public sealed class PrototypeHud : MonoBehaviour
{
    private static PrototypeHud instance = null!;
    private ChibiPlayerController player = null!;

    private GUIStyle pillStyle = null!;
    private GUIStyle textStyle = null!;
    private GUIStyle buttonStyle = null!;
    private GUIStyle modalStyle = null!;
    private GUIStyle bigCountStyle = null!;

    // Tràng hạt bồ đề 108
    private bool showBeadsModal;
    private int beadCount;
    private int roundCount;

    // Âm thanh & Mõ
    private int mokoCount;
    private bool audioPlaying = true;
    private AudioSource chantAudio = null!;

    // Toast thông báo
    private string toastMessage = "";
    private float toastTimer;

    public static void ShowToast(string message, float duration = 3.5f)
    {
        if (instance != null)
        {
            instance.toastMessage = message;
            instance.toastTimer = duration;
        }
    }

    private void Awake()
    {
        instance = this;
        player = FindFirstObjectByType<ChibiPlayerController>();
        SetupChantAudio();
    }

    private void SetupChantAudio()
    {
        chantAudio = gameObject.AddComponent<AudioSource>();
        chantAudio.loop = true;
        chantAudio.playOnAwake = false;
        chantAudio.volume = 0.5f;

        var clip = Resources.Load<AudioClip>("Audio/temple-chant-review-v1");
        if (clip != null)
        {
            chantAudio.clip = clip;
            chantAudio.Play();
        }
    }

    private void Update()
    {
        if (toastTimer > 0)
        {
            toastTimer -= Time.deltaTime;
            if (toastTimer <= 0) toastMessage = "";
        }
    }

    private void OnGUI()
    {
        InitStyles();

        var scale = Mathf.Clamp(Screen.width / 512f, 0.85f, 1.8f);

        // 1. THANH ĐIỀU HƯỚNG TRÊN (TOP BAR)
        DrawTopNav(scale);

        // 2. BANNER TOAST THÔNG BÁO TÂM LINH GIỮA MÀN HÌNH
        DrawToastNotification(scale);

        // 3. THANH TÁC VỤ DƯỚI (BOTTOM BAR)
        DrawBottomBar(scale);

        // 4. MODAL TRÀNG HẠT 108 (NẾU MỞ)
        if (showBeadsModal)
        {
            DrawBeadsModal(scale);
        }
    }

    private void DrawTopNav(float scale)
    {
        var top = new Rect(12 * scale, 12 * scale, Screen.width - 24 * scale, 48 * scale);
        GUI.Box(top, "", pillStyle);

        var roomText = "🛕 Chùa Online - Chánh Điện 01";
        GUI.Label(new Rect(20 * scale, top.y, 240 * scale, top.height), roomText, textStyle);

        int count = TempleNetworkClient.Instance != null ? TempleNetworkClient.Instance.OnlineCount : 100;
        GUI.Label(new Rect(Screen.width * 0.52f, top.y, 110 * scale, top.height), $"👥 {count}", textStyle);

        // Nút Bật/Tắt Tụng Kinh
        var audioIcon = audioPlaying ? "🔊 Kinh" : "🔇 Tắt";
        if (GUI.Button(new Rect(Screen.width - 105 * scale, top.y + 6 * scale, 88 * scale, top.height - 12 * scale), audioIcon, buttonStyle))
        {
            audioPlaying = !audioPlaying;
            if (chantAudio != null)
            {
                if (audioPlaying) chantAudio.UnPause();
                else chantAudio.Pause();
            }
        }
    }

    private void DrawToastNotification(float scale)
    {
        string display = !string.IsNullOrEmpty(toastMessage) ? toastMessage : "Đang thành tâm hướng Phật 🙏";
        var width = Mathf.Min(340 * scale, Screen.width - 40 * scale);
        var height = 38 * scale;
        var rect = new Rect((Screen.width - width) / 2f, 74 * scale, width, height);

        GUI.Box(rect, display, pillStyle);
    }

    private void DrawBottomBar(float scale)
    {
        var btnHeight = 50 * scale;
        var y = Screen.height - btnHeight - 16 * scale;
        var pad = 12 * scale;
        var gap = 8 * scale;

        // 4 nút: Lạy Phật | Chắp tay | Tọa thiền | Tràng hạt
        int btnCount = 4;
        var totalAvailable = Screen.width - 2 * pad - (btnCount - 1) * gap;
        var btnWidth = totalAvailable / btnCount;

        // Nút 1: Lạy Phật (Bow)
        if (GUI.Button(new Rect(pad, y, btnWidth, btnHeight), "🙇\nLạy Phật", buttonStyle))
        {
            player?.SetPosture(3);
            TempleNetworkClient.Instance?.SendAction("bow");
        }

        // Nút 2: Chắp tay (Gassho / Kneel)
        if (GUI.Button(new Rect(pad + (btnWidth + gap), y, btnWidth, btnHeight), "🙏\nChắp tay", buttonStyle))
        {
            player?.SetPosture(2);
            TempleNetworkClient.Instance?.SendAction("gassho");
        }

        // Nút 3: Tọa thiền (Sit / Stand)
        if (GUI.Button(new Rect(pad + (btnWidth + gap) * 2, y, btnWidth, btnHeight), "🧘\nTọa thiền", buttonStyle))
        {
            player?.SetPosture(1);
            TempleNetworkClient.Instance?.SendAction("sit");
        }

        // Nút 4: Tràng Hạt 108
        if (GUI.Button(new Rect(pad + (btnWidth + gap) * 3, y, btnWidth, btnHeight), "📿\nTràng hạt", buttonStyle))
        {
            showBeadsModal = true;
        }
    }

    private void DrawBeadsModal(float scale)
    {
        // Phủ nền mờ
        GUI.color = new Color(0, 0, 0, 0.7f);
        GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
        GUI.color = Color.white;

        var modalWidth = Mathf.Min(360 * scale, Screen.width - 32 * scale);
        var modalHeight = 400 * scale;
        var modalRect = new Rect((Screen.width - modalWidth) / 2f, (Screen.height - modalHeight) / 2f, modalWidth, modalHeight);

        GUI.Box(modalRect, "", modalStyle);

        // Tiêu đề
        GUI.Label(new Rect(modalRect.x, modalRect.y + 16 * scale, modalRect.width, 32 * scale), "📿 Chuỗi Tràng Hạt Bồ Đề", textStyle);
        GUI.Label(new Rect(modalRect.x, modalRect.y + 48 * scale, modalRect.width, 24 * scale), "Chạm vào hạt để niệm Nam Mô A Di Đà Phật", textStyle);

        // Vòng tròn lần hạt lớn
        var beadBtnSize = 130 * scale;
        var beadBtnRect = new Rect(modalRect.x + (modalRect.width - beadBtnSize) / 2f, modalRect.y + 88 * scale, beadBtnSize, beadBtnSize);
        if (GUI.Button(beadBtnRect, $"{beadCount}\n/ 108", bigCountStyle))
        {
            AdvanceBead();
        }

        // Thông tin vòng niệm
        GUI.Label(new Rect(modalRect.x, modalRect.y + 235 * scale, modalRect.width, 26 * scale), $"Đã hoàn thành: {roundCount} vòng (108 hạt/vòng)", textStyle);

        // Nút Đóng
        var closeRect = new Rect(modalRect.x + 30 * scale, modalRect.y + modalHeight - 55 * scale, modalRect.width - 60 * scale, 42 * scale);
        if (GUI.Button(closeRect, "Hoàn tất chiêm bái", buttonStyle))
        {
            showBeadsModal = false;
        }
    }

    private void AdvanceBead()
    {
        beadCount++;
        if (beadCount >= 108)
        {
            beadCount = 0;
            roundCount++;
            ShowToast("Công đức vô lượng! Đã hoàn thành 1 vòng 108 hạt bồ đề 📿");
        }
        else
        {
            ShowToast($"Hạt thứ {beadCount} — Nam Mô A Di Đà Phật 📿", 1.2f);
        }
    }

    private void InitStyles()
    {
        pillStyle ??= new GUIStyle(GUI.skin.box)
        {
            alignment = TextAnchor.MiddleCenter,
            fontSize = 15,
            normal = { textColor = new Color(0.96f, 0.93f, 0.88f), background = MakeTexture(new Color(0.12f, 0.09f, 0.07f, 0.88f)) }
        };

        textStyle ??= new GUIStyle(GUI.skin.label)
        {
            alignment = TextAnchor.MiddleCenter,
            fontSize = 14,
            fontStyle = FontStyle.Bold,
            normal = { textColor = new Color(0.96f, 0.93f, 0.88f) }
        };

        buttonStyle ??= new GUIStyle(GUI.skin.button)
        {
            fontSize = 13,
            alignment = TextAnchor.MiddleCenter,
            normal = { textColor = new Color(0.98f, 0.95f, 0.90f), background = MakeTexture(new Color(0.18f, 0.14f, 0.10f, 0.92f)) },
            hover = { textColor = new Color(1.0f, 0.82f, 0.40f) },
            active = { textColor = new Color(1.0f, 0.70f, 0.20f) }
        };

        modalStyle ??= new GUIStyle(GUI.skin.box)
        {
            alignment = TextAnchor.UpperCenter,
            normal = { background = MakeTexture(new Color(0.14f, 0.10f, 0.08f, 0.96f)) }
        };

        bigCountStyle ??= new GUIStyle(GUI.skin.button)
        {
            fontSize = 24,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.MiddleCenter,
            normal = { textColor = new Color(1f, 0.86f, 0.48f), background = MakeTexture(new Color(0.28f, 0.18f, 0.10f, 0.95f)) }
        };
    }

    private static Texture2D MakeTexture(Color color)
    {
        var texture = new Texture2D(1, 1);
        texture.SetPixel(0, 0, color);
        texture.Apply();
        return texture;
    }
}
}
