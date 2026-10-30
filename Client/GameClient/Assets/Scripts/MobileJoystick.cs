using UnityEngine;

namespace ChuaOnline.Gameplay
{
public sealed class MobileJoystick : MonoBehaviour
{
    public static Vector2 InputValue { get; private set; }
    private int fingerId = -1;
    private Vector2 start;
    private const float Radius = 72f;

    private void Update()
    {
        if (!Application.isMobilePlatform) return;
        for (var i = 0; i < Input.touchCount; i++)
        {
            var touch = Input.GetTouch(i);
            if (touch.phase == TouchPhase.Began && touch.position.x < Screen.width * .48f && touch.position.y < Screen.height * .45f)
            { fingerId = touch.fingerId; start = touch.position; }
            if (touch.fingerId != fingerId) continue;
            if (touch.phase is TouchPhase.Moved or TouchPhase.Stationary) InputValue = Vector2.ClampMagnitude((touch.position - start) / Radius, 1f);
            if (touch.phase is TouchPhase.Ended or TouchPhase.Canceled) { fingerId = -1; InputValue = Vector2.zero; }
        }
    }

    private void OnGUI()
    {
        if (!Application.isMobilePlatform) return;
        var center = start == Vector2.zero ? new Vector2(92, Screen.height - 112) : new Vector2(start.x, Screen.height - start.y);
        GUI.color = new Color(1, 1, 1, .18f); GUI.DrawTexture(new Rect(center.x - Radius, center.y - Radius, Radius * 2, Radius * 2), Texture2D.whiteTexture);
        GUI.color = new Color(1, 1, 1, .35f); var knob = center + InputValue * Radius; GUI.DrawTexture(new Rect(knob.x - 24, knob.y - 24, 48, 48), Texture2D.whiteTexture); GUI.color = Color.white;
    }
}
}
